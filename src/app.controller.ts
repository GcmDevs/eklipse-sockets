import { Controller, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GCM_CONTEXTS_VALUES, GcmContextCode, GcmContextType } from '@common/domain/types';
import { _PrivSecUserOrm } from '@common/infrastructure/orm/user.orm';
import { switchConn, switchSocketsConn } from '@common/infrastructure/services';
import { CommonGuards } from '@common/presentation/decorators';
import { normalizeDocument } from '@socket/chat/domain/types';
import { ChatUserOrm, LastUserRegisteredByContextOrm } from '@socket/chat/infrastructure/orm';
import { EntityManager, MoreThan, Repository } from 'typeorm';

const USER_BATCH_SIZE = 500;

interface ContextSynchronizationResult {
  context: GcmContextCode;
  success: true;
  previousLastId: number;
  lastId: number;
  reviewed: number;
  registered: number;
  skipped: number;
}

interface ContextSynchronizationError {
  context: GcmContextCode;
  success: false;
  error: string;
}

interface UserSynchronizationResult {
  success: boolean;
  reviewed: number;
  registered: number;
  skipped: number;
  contexts: (ContextSynchronizationResult | ContextSynchronizationError)[];
}

interface BatchSynchronizationResult {
  previousLastId: number;
  lastId: number;
  reviewed: number;
  registered: number;
}

@ApiTags('App')
@CommonGuards()
@Controller()
export class AppController {
  private activeSynchronization?: Promise<UserSynchronizationResult>;

  @Post('register-new-users')
  @ApiOperation({ summary: 'Registra en el chat los usuarios nuevos de cada contexto' })
  public async registerNewUsers(): Promise<UserSynchronizationResult> {
    if (this.activeSynchronization) return this.activeSynchronization;

    const synchronization = this.synchronizeUsers();
    this.activeSynchronization = synchronization;

    try {
      return await synchronization;
    } finally {
      if (this.activeSynchronization === synchronization) this.activeSynchronization = undefined;
    }
  }

  private async synchronizeUsers(): Promise<UserSynchronizationResult> {
    const chatConnection = switchSocketsConn();
    if (!chatConnection.isInitialized) {
      throw new ServiceUnavailableException('La base de datos del chat no está disponible.');
    }

    const contexts: (ContextSynchronizationResult | ContextSynchronizationError)[] = [];

    for (const context of GCM_CONTEXTS_VALUES) {
      try {
        contexts.push(await this.synchronizeContext(context));
      } catch (error: unknown) {
        contexts.push({
          context: context.getCode(),
          success: false,
          error: error instanceof Error ? error.message : 'No fue posible sincronizar el contexto.',
        });
      }
    }

    const completed = contexts.filter(
      (context): context is ContextSynchronizationResult => context.success
    );

    return {
      success: completed.length === contexts.length,
      reviewed: completed.reduce((total, context) => total + context.reviewed, 0),
      registered: completed.reduce((total, context) => total + context.registered, 0),
      skipped: completed.reduce((total, context) => total + context.skipped, 0),
      contexts,
    };
  }

  private async synchronizeContext(context: GcmContextType): Promise<ContextSynchronizationResult> {
    const sourceConnection = switchConn(context);
    if (!sourceConnection.isInitialized) {
      throw new ServiceUnavailableException(
        `La base de datos de ${context.getForHumans()} no está disponible.`
      );
    }

    const sourceUsers = sourceConnection.getRepository(_PrivSecUserOrm);
    const chatConnection = switchSocketsConn();
    let previousLastId: number | undefined;
    let lastId = 0;
    let reviewed = 0;
    let registered = 0;
    let batchSize: number;

    do {
      const batch = await chatConnection.transaction(manager =>
        this.synchronizeBatch(manager, context, sourceUsers)
      );

      previousLastId ??= batch.previousLastId;
      lastId = batch.lastId;
      reviewed += batch.reviewed;
      registered += batch.registered;
      batchSize = batch.reviewed;
    } while (batchSize === USER_BATCH_SIZE);

    return {
      context: context.getCode(),
      success: true,
      previousLastId: previousLastId ?? 0,
      lastId,
      reviewed,
      registered,
      skipped: reviewed - registered,
    };
  }

  private async synchronizeBatch(
    manager: EntityManager,
    context: GcmContextType,
    sourceUsers: Repository<_PrivSecUserOrm>
  ): Promise<BatchSynchronizationResult> {
    const trackerRepository = manager.getRepository(LastUserRegisteredByContextOrm);
    let tracker = await trackerRepository.findOne({
      where: { context: context.getCode() },
      lock: { mode: 'pessimistic_write' },
    });

    if (!tracker) {
      tracker = await trackerRepository.save(
        trackerRepository.create({ context: context.getCode(), lastId: 0 })
      );
    }

    const previousLastId = Math.max(0, Number(tracker.lastId) || 0);
    const users = await sourceUsers.find({
      select: { id: true, document: true, fullName: true },
      where: { id: MoreThan(previousLastId) },
      order: { id: 'ASC' },
      take: USER_BATCH_SIZE,
    });

    if (!users.length) {
      return { previousLastId, lastId: previousLastId, reviewed: 0, registered: 0 };
    }

    const lastId = Math.max(...users.map(user => Number(user.id)));
    if (!Number.isFinite(lastId) || lastId <= previousLastId) {
      throw new Error(`No fue posible determinar el siguiente OID de ${context.getCode()}.`);
    }

    const usersByDocument = new Map<string, Pick<ChatUserOrm, 'document' | 'fullName'>>();
    for (const user of users) {
      const document = normalizeDocument(String(user.document ?? ''));
      if (!document || usersByDocument.has(document)) continue;

      usersByDocument.set(document, {
        document,
        fullName: String(user.fullName ?? '').trim(),
      });
    }

    const chatUserRepository = manager.getRepository(ChatUserOrm);
    const documents = [...usersByDocument.keys()];
    const existingUsers = documents.length
      ? await chatUserRepository
          .createQueryBuilder('chatUser')
          .select(['chatUser.document'])
          .where('chatUser.document IN (:...documents)', { documents })
          .getMany()
      : [];
    const existingDocuments = new Set(
      existingUsers.map(user => normalizeDocument(String(user.document ?? '')))
    );
    const newUsers = [...usersByDocument.values()].filter(
      user => !existingDocuments.has(user.document)
    );

    let registered = 0;
    if (newUsers.length) {
      const insertion = await chatUserRepository
        .createQueryBuilder()
        .insert()
        .into(ChatUserOrm)
        .values(newUsers)
        .orIgnore()
        .execute();
      registered = Array.isArray(insertion.raw) ? insertion.raw.length : newUsers.length;
    }

    tracker.lastId = lastId;
    await trackerRepository.save(tracker);

    return { previousLastId, lastId, reviewed: users.length, registered };
  }
}
