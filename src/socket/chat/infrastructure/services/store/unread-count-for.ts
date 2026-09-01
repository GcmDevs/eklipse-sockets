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
        'reading.CHATCONVERSACION = message.CHATCONVERSACION AND reading.CHATUSUREG = :userId',
        { userId }
      )
      .select('COUNT(message.OID)', 'unreadCount')
      .where('message.CHATUSUREG2 = :userId', { userId })
      .andWhere('message.OID > COALESCE(reading.CHATMENSAJE, 0)')
      .andWhere('message.FECELI IS NULL')
      .getRawOne<{ unreadCount: number | string }>();

    const unreadCount = Number(row?.unreadCount ?? 0);
    return Number.isSafeInteger(unreadCount) && unreadCount > 0 ? unreadCount : 0;
  }
}
