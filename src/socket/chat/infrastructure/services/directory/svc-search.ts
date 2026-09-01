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

    const escapedTerm = term.replace(/\[/g, '[[]').replace(/%/g, '[%]').replace(/_/g, '[_]');
    const queryBuilder = this.sharedConn
      .getRepository(ChatUserOrm)
      .createQueryBuilder('chatUser')
      .where('(chatUser.USUDOCUME LIKE :term OR chatUser.USUDESCRI LIKE :term)', {
        term: `%${escapedTerm}%`,
      });
    const excluded = [
      ...new Set(excludedDocuments.map(normalizeDocument).filter(document => document)),
    ];
    if (excluded.length) {
      queryBuilder.andWhere('chatUser.USUDOCUME NOT IN (:...excludedDocuments)', {
        excludedDocuments: excluded,
      });
    }

    const records = await queryBuilder
      .orderBy('chatUser.USUDESCRI', 'ASC')
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
