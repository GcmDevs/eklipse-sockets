import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { GCM_CONTEXTS } from '@common/domain/types';
import { switchConn } from '@common/infrastructure/services';
import { ChatUserOrm } from '../orm/user.orm';
import type { RegisteredChatUser } from '../../domain/types/types';
import { normalizeDocument } from '../../domain/types/types';

@Injectable()
export class ChatDirectoryService {
  private static readonly MAX_SEARCH_RESULTS = 20;
  private readonly sharedConn = switchConn(GCM_CONTEXTS.EKLIPSE);

  async search(query: string, excludeDocument = ''): Promise<RegisteredChatUser[]> {
    const term = query.trim().slice(0, 80);
    if (!term) return [];

    const escapedTerm = term.replace(/\[/g, '[[]').replace(/%/g, '[%]').replace(/_/g, '[_]');
    const records = await this.sharedConn
      .getRepository(ChatUserOrm)
      .createQueryBuilder('chatUser')
      .where('(chatUser.USUDOCUME LIKE :term OR chatUser.USUDESCRI LIKE :term)', {
        term: `%${escapedTerm}%`,
      })
      .orderBy('chatUser.USUDESCRI', 'ASC')
      .take(ChatDirectoryService.MAX_SEARCH_RESULTS)
      .getMany();
    const usersByDocument = new Map<string, RegisteredChatUser>();
    const excluded = normalizeDocument(excludeDocument);

    for (const record of records) {
      const user = this.toChatUser(record);
      if (user && user.document !== excluded) usersByDocument.set(user.document, user);
    }

    return [...usersByDocument.values()];
  }

  async findByDocument(document: unknown): Promise<RegisteredChatUser | undefined> {
    const normalized = normalizeDocument(document);
    if (!normalized) return undefined;

    const record = await this.sharedConn.getRepository(ChatUserOrm).findOne({
      where: { document: normalized },
    });
    return record ? this.toChatUser(record) : undefined;
  }

  async findByIds(ids: number[]): Promise<RegisteredChatUser[]> {
    const uniqueIds = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
    if (!uniqueIds.length) return [];

    const records = await this.sharedConn.getRepository(ChatUserOrm).find({
      where: { id: In(uniqueIds) },
    });
    return records.map(record => this.toChatUser(record)).filter(user => user !== undefined);
  }

  private toChatUser(record: ChatUserOrm): RegisteredChatUser | undefined {
    const id = Number(record.id);
    const document = normalizeDocument(String(record.document ?? ''));
    const name = String(record.fullName ?? '').trim();
    return Number.isInteger(id) && id > 0 && document && name ? { id, document, name } : undefined;
  }
}
