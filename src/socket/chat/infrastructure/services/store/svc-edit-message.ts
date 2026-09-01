import { Injectable } from '@nestjs/common';
import { CRYPTO_CHAT_SERVICES } from '@common/application/services';
import type { ChatMessageMutationResult, RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatMessageOrm } from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatEditMessageImpl extends ChatStoreSharedSource {
  async execute(
    messageId: number,
    currentUser: RegisteredChatUser,
    content: string
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
      if (!content && !message.attachments.length) return { ok: false, error: 'empty' };

      message.content = content ? CRYPTO_CHAT_SERVICES.encrypt(content) : null;
      message.editedAt = new Date();
      await repository.save(message);

      return {
        ok: true,
        message: this.toChatMessage(message, currentUser, currentUser.document),
      };
    });
  }
}
