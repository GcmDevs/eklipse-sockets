import { Injectable } from '@nestjs/common';
import { CRYPTO_CHAT_SERVICES } from '@common/application/services';
import { ChatReplyMessageNotFoundError } from '@socket/chat/domain/types';
import type { ChatMessage, RegisteredChatUser } from '@socket/chat/domain/types';
import {
  ChatConversationOrm,
  ChatConversationReadOrm,
  ChatMessageAttachmentOrm,
  ChatMessageOrm,
} from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatAddMessageImpl extends ChatStoreSharedSource {
  async execute(
    conversationId: number,
    currentUser: RegisteredChatUser,
    content: string,
    attachments: string[],
    replyToMessageId?: number
  ): Promise<ChatMessage | undefined> {
    return this.sharedConn.transaction(async manager => {
      const conversationRepository = manager.getRepository(ChatConversationOrm);
      const messageRepository = manager.getRepository(ChatMessageOrm);
      const attachmentRepository = manager.getRepository(ChatMessageAttachmentOrm);
      const conversation = await conversationRepository.findOne({
        where: { id: conversationId },
        relations: ['firstUser', 'secondUser'],
      });
      if (!conversation || !this.hasParticipant(conversation, currentUser.id)) return undefined;

      const recipient = this.otherParticipant(conversation, currentUser.id);
      if (!recipient) return undefined;

      const replyToMessage = replyToMessageId
        ? await messageRepository.findOne({
            where: { id: replyToMessageId, conversationId },
            relations: ['senderUser', 'attachments'],
          })
        : null;
      if (replyToMessageId && (!replyToMessage || replyToMessage.deletedAt)) {
        throw new ChatReplyMessageNotFoundError();
      }

      const createdAt = new Date();
      const message = await messageRepository.save(
        messageRepository.create({
          conversationId,
          senderUserId: currentUser.id,
          recipientUserId: recipient.id,
          content: content ? CRYPTO_CHAT_SERVICES.encrypt(content) : null,
          replyToMessageId: replyToMessage?.id ?? null,
          createdAt,
        })
      );

      message.attachments = attachments.length
        ? await attachmentRepository.save(
            attachments.map(path =>
              attachmentRepository.create({
                messageId: message.id,
                path: path.split('/').at(-1),
              })
            )
          )
        : [];
      message.replyToMessage = replyToMessage;

      conversation.lastMessageId = message.id;
      conversation.lastSenderUserId = currentUser.id;
      conversation.updatedAt = createdAt;
      await conversationRepository.save(conversation);
      await manager
        .getRepository(ChatConversationReadOrm)
        .update({ conversationId }, { hiddenAt: null });

      return this.toChatMessage(
        message,
        currentUser,
        attachments.length ? attachments[0].split('/').at(-2) : null
      );
    });
  }
}
