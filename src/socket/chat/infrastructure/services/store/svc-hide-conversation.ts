import { Injectable } from '@nestjs/common';
import type { ChatConversationHidden, RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatConversationOrm, ChatConversationReadOrm } from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatHideConversationImpl extends ChatStoreSharedSource {
  async execute(
    conversationId: number,
    currentUser: RegisteredChatUser
  ): Promise<ChatConversationHidden | undefined> {
    return this.sharedConn.transaction('SERIALIZABLE', async manager => {
      const conversation = await manager.getRepository(ChatConversationOrm).findOne({
        where: { id: conversationId },
      });
      if (!conversation || !this.hasParticipant(conversation, currentUser.id)) return undefined;

      const repository = manager.getRepository(ChatConversationReadOrm);
      const existing = await repository.findOne({
        where: { conversationId: conversation.id, userId: currentUser.id },
      });
      const lastMessageId = Number(conversation.lastMessageId ?? 0);

      await repository.save(
        repository.create({
          ...existing,
          conversationId: conversation.id,
          userId: currentUser.id,
          lastReadMessageId: lastMessageId || existing?.lastReadMessageId || null,
          hiddenAt: new Date(),
          updatedAt: new Date(),
        })
      );

      return {
        conversationId: conversation.id,
        lastMessageId: conversation.lastMessageId ?? null,
      };
    });
  }
}
