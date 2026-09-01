import { Injectable } from '@nestjs/common';
import type { ChatMessageMutationResult, RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatMessageOrm } from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatDeleteMessageImpl extends ChatStoreSharedSource {
  async execute(
    messageId: number,
    currentUser: RegisteredChatUser
  ): Promise<ChatMessageMutationResult> {
    return this.sharedConn.transaction('SERIALIZABLE', async manager => {
      const repository = manager.getRepository(ChatMessageOrm);
      const message = await repository.findOne({
        where: { id: messageId },
        relations: [
          'senderUser',
          'attachments',
          'replyToMessage',
          'replyToMessage.senderUser',
          'replyToMessage.attachments',
        ],
      });
      const error = this.messageMutationErrorFor(message, currentUser.id);
      if (error) return { ok: false, error };

      message.deletedAt = new Date();
      await repository.save(message);

      return {
        ok: true,
        message: this.toChatMessage(message, currentUser, currentUser.document),
      };
    });
  }
}
