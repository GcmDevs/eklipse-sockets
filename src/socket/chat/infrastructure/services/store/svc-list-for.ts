import { Injectable } from '@nestjs/common';
import type { ChatConversationSummary } from '@socket/chat/domain/types';
import { ChatConversationOrm } from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatListForImpl extends ChatStoreSharedSource {
  async execute(
    userId: number,
    isOnline: (contactDocument: string) => boolean
  ): Promise<ChatConversationSummary[]> {
    const conversations = await this.sharedConn.getRepository(ChatConversationOrm).find({
      where: [{ firstUserId: userId }, { secondUserId: userId }],
      relations: [
        'firstUser',
        'secondUser',
        'lastMessage',
        'lastMessage.attachments',
        'lastMessage.replyToMessage',
        'lastMessage.replyToMessage.senderUser',
        'lastMessage.replyToMessage.attachments',
        'lastSenderUser',
      ],
      order: { updatedAt: 'DESC' },
    });

    const conversationIds = conversations.map(conversation => conversation.id);
    const unreadStates = await this.unreadStatesFor(userId, conversationIds);

    return conversations
      .filter(conversation => !unreadStates.get(conversation.id)?.hidden)
      .map(conversation => {
        const unreadState = unreadStates.get(conversation.id);
        return this.summaryFor(
          conversation,
          userId,
          isOnline,
          unreadState?.unreadCount ?? 0,
          unreadState?.lastReadMessageId ?? null,
          false
        );
      });
  }
}
