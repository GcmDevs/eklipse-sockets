import { Injectable } from '@nestjs/common';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { normalizeDocument } from '@socket/chat/domain/types';
import { ChatUserOrm } from '@socket/chat/infrastructure/orm';
import { ChatDirectorySharedSource } from './shared-source';

@Injectable()
export class ChatDirectorySearchImpl extends ChatDirectorySharedSource {
  async execute(
    query: string,
    excludeDocument = '',
    excludedDocuments: readonly string[] = []
  ): Promise<RegisteredChatUser[]> {
    const term = query.trim().slice(0, 80);
    if (!term) return [];

    // PostgreSQL does not support SQL Server's bracket escaping ([%], [_]).
    // Use an explicit escape character so user input cannot become a LIKE pattern.
    const escapedTerm = term.replace(/[!%_]/g, character => `!${character}`);
    const queryBuilder = this.sharedConn
      .getRepository(ChatUserOrm)
      .createQueryBuilder('chatUser')
      .where(
        `(chatUser.document ILIKE :term ESCAPE '!'
          OR chatUser.fullName ILIKE :term ESCAPE '!')`,
        { term: `%${escapedTerm}%` }
      );
    const excluded = [
      ...new Set(excludedDocuments.map(normalizeDocument).filter(document => document)),
    ];
    if (excluded.length) {
      queryBuilder.andWhere('chatUser.document NOT IN (:...excludedDocuments)', {
        excludedDocuments: excluded,
      });
    }

    const records = await queryBuilder
      .orderBy('chatUser.fullName', 'ASC')
      .take(this.MAX_SEARCH_RESULTS)
      .getMany();
    const usersByDocument = new Map<string, RegisteredChatUser>();
    const excludedCurrentUser = normalizeDocument(excludeDocument);

    for (const record of records) {
      const user = this.toChatUser(record);
      if (user && user.document !== excludedCurrentUser) usersByDocument.set(user.document, user);
    }

    return [...usersByDocument.values()];
  }
}
