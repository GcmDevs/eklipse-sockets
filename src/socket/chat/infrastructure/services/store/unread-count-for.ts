import { Injectable } from '@nestjs/common';
import { ChatConversationReadOrm, ChatMessageOrm } from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatUnreadCountForImpl extends ChatStoreSharedSource {
  async execute(userId: number): Promise<number> {
    const row = await this.sharedConn
      .getRepository(ChatMessageOrm)
      .createQueryBuilder('message')
      .leftJoin(
        ChatConversationReadOrm,
        'reading',
        'reading.conversationId = message.conversationId AND reading.userId = :userId',
        { userId }
      )
      .select('COUNT(message.id)', 'unreadCount')
      .where('message.recipientUserId = :userId', { userId })
      .andWhere('message.id > COALESCE(reading.lastReadMessageId, 0)')
      .andWhere('message.deletedAt IS NULL')
      .getRawOne<{ unreadCount: number | string }>();

    const unreadCount = Number(row?.unreadCount ?? 0);
    return Number.isSafeInteger(unreadCount) && unreadCount > 0 ? unreadCount : 0;
  }
}
