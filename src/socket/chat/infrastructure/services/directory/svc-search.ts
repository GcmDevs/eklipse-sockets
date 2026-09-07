import { chatAccessPredicate } from '../access';
import { Injectable } from '@nestjs/common';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { SocketUserOrm } from '@socket/common/orm';
import { ChatDirectorySharedSource } from './shared-source';

@Injectable()
export class ChatDirectorySearchImpl extends ChatDirectorySharedSource {
  async execute(query: string, actorId: number): Promise<RegisteredChatUser[]> {
    const term = query.trim().slice(0, 80);
    if (!term) return [];

    // PostgreSQL does not support SQL Server's bracket escaping ([%], [_]).
    // Use an explicit escape character so user input cannot become a LIKE pattern.
    const escapedTerm = term.replace(/[!%_]/g, character => `!${character}`);
    const queryBuilder = this.sharedConn
      .getRepository(SocketUserOrm)
      .createQueryBuilder('chatUser')
      .where(
        `(chatUser.document ILIKE :term ESCAPE '!'
          OR chatUser.fullName ILIKE :term ESCAPE '!')`,
        { term: `%${escapedTerm}%` }
      );
    if (!Number.isSafeInteger(actorId) || actorId <= 0) return [];
    queryBuilder.andWhere(chatAccessPredicate(':actorId', '"chatUser"."OID"'), { actorId });
    const records = await queryBuilder
      .orderBy('chatUser.fullName', 'ASC')
      .take(this.MAX_SEARCH_RESULTS)
      .getMany();
    const usersByDocument = new Map<string, RegisteredChatUser>();

    for (const record of records) {
      const user = this.toChatUser(record);
      if (user) usersByDocument.set(user.document, user);
    }

    return [...usersByDocument.values()];
  }
}
