import { Injectable } from '@nestjs/common';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatDirectoryFindByDocumentImpl } from './svc-find-by-document';
import { ChatDirectoryFindByIdsImpl } from './svc-find-by-ids';
import { ChatDirectorySearchImpl } from './svc-search';

@Injectable()
export class ChatDirectoryService {
  constructor(
    private readonly _search: ChatDirectorySearchImpl,
    private readonly _findByDocument: ChatDirectoryFindByDocumentImpl,
    private readonly _findByIds: ChatDirectoryFindByIdsImpl
  ) {}

  async search(
    query: string,
    excludeDocument = '',
    excludedDocuments: readonly string[] = []
  ): Promise<RegisteredChatUser[]> {
    return this._search.execute(query, excludeDocument, excludedDocuments);
  }

  async findByDocument(document: unknown): Promise<RegisteredChatUser | undefined> {
    return this._findByDocument.execute(document);
  }

  async findByIds(ids: number[]): Promise<RegisteredChatUser[]> {
    return this._findByIds.execute(ids);
  }
}
