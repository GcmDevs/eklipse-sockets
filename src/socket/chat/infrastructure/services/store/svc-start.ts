import { ChatConversationOrm } from '@socket/chat/infrastructure/orm';
import type { ChatConversationDetails, RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatStoreSharedSource } from './shared-source';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatStartImpl extends ChatStoreSharedSource {
  async execute(
    currentUser: RegisteredChatUser,
    contact: RegisteredChatUser,
    isOnline: (document: string) => boolean
  ): Promise<ChatConversationDetails> {
    const [firstUser, secondUser] = [currentUser, contact].sort(
      (left, right) => left.id - right.id
    );
    const conversationId = await this.sharedConn.transaction('SERIALIZABLE', async manager => {
      const repository = manager.getRepository(ChatConversationOrm);
      const existing = await repository.findOne({
        where: { firstUserId: firstUser.id, secondUserId: secondUser.id },
      });
      if (existing) return existing.id;

      const now = new Date();
      const saved = await repository.save(
        repository.create({
          firstUserId: firstUser.id,
          secondUserId: secondUser.id,
          createdAt: now,
          updatedAt: now,
        })
      );
      return saved.id;
    });
    const conversation = await this.findConversationById(conversationId);

    if (!conversation) throw new Error('Conversation was not persisted');
    await this.markConversationReadFor(conversation, currentUser.id);
    return this.detailsFor(conversation, currentUser.id, isOnline);
  }
}
