import { Injectable } from '@nestjs/common';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatMarkConversationReadImpl extends ChatStoreSharedSource {
  async execute(
    conversationId: number,
    currentUser: RegisteredChatUser
  ): Promise<boolean | undefined> {
    const conversation = await this.findConversationById(conversationId);
    if (!conversation || !this.hasParticipant(conversation, currentUser.id)) return undefined;

    await this.markConversationReadFor(conversation, currentUser.id);
    return true;
  }
}
