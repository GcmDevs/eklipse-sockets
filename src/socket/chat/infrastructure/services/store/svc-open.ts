import { Injectable } from '@nestjs/common';
import type { ChatConversationDetails, RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatOpenImpl extends ChatStoreSharedSource {
  async execute(
    conversationId: number,
    currentUser: RegisteredChatUser,
    isOnline: (document: string) => boolean,
    markAsRead = true
  ): Promise<ChatConversationDetails | undefined> {
    const conversation = await this.findConversationById(conversationId);
    if (!conversation || !this.hasParticipant(conversation, currentUser.id)) return undefined;
    if (markAsRead) await this.markConversationReadFor(conversation, currentUser.id);
    return this.detailsFor(conversation, currentUser.id, isOnline);
  }
}
