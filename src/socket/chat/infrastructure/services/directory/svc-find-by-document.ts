import { Injectable } from '@nestjs/common';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { normalizeDocument } from '@socket/chat/domain/types';
import { ChatUserOrm } from '@socket/chat/infrastructure/orm';
import { ChatDirectorySharedSource } from './shared-source';

@Injectable()
export class ChatDirectoryFindByDocumentImpl extends ChatDirectorySharedSource {
  async execute(document: unknown): Promise<RegisteredChatUser | undefined> {
    const normalized = normalizeDocument(document);
    if (!normalized) return undefined;

    const record = await this.sharedConn.getRepository(ChatUserOrm).findOne({
      where: { document: normalized },
    });
    return record ? this.toChatUser(record) : undefined;
  }
}
