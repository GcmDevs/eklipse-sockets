import { Injectable } from '@nestjs/common';
import type { ChatMessagePage, RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatLoadPreviousMessagesImpl extends ChatStoreSharedSource {
  async execute(
    conversationId: number,
    currentUser: RegisteredChatUser,
    beforeMessageId: number
  ): Promise<ChatMessagePage | undefined> {
    const conversation = await this.findConversationById(conversationId);
    if (!conversation || !(await this.canAccessConversation(conversation, currentUser.id)))
      return undefined;

    return this.messagePage(conversationId, beforeMessageId);
  }
}
