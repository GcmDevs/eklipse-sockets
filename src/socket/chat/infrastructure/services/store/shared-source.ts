import { CRYPTO_CHAT_SERVICES } from '@common/application/services';
import { switchSocketsConn } from '@common/infrastructure/services';
import { FILE_PATHS } from '@file-saver/locations';
import type {
  RegisteredChatUser,
  ChatMessageMutationError,
  ChatUser,
  ChatMessage,
  ChatMessageReply,
  ChatConversationDetails,
  ChatConversationSummary,
  ChatMessagePage,
} from '@socket/chat/domain/types';
import { CHAT_MESSAGE_MUTATION_WINDOW_MS, normalizeDocument } from '@socket/chat/domain/types';
import {
  ChatConversationOrm,
  ChatMessageOrm,
  ChatMessageAttachmentOrm,
  ChatConversationReadOrm,
} from '../../orm';
import { LessThan } from 'typeorm';

export interface ChatUnreadState {
  lastReadMessageId: number | null;
  unreadCount: number;
  hidden: boolean;
}

export class ChatStoreSharedSource {
  protected readonly MESSAGES_PAGE_SIZE = 30;
  protected readonly sharedConn = switchSocketsConn();

  protected async detailsFor(
    conversation: ChatConversationOrm,
    userId: number,
    isOnline: (contactDocument: string) => boolean
  ): Promise<ChatConversationDetails> {
    const [messagePage, unreadStates] = await Promise.all([
      this.messagePage(conversation.id),
      this.unreadStatesFor(userId, [conversation.id]),
    ]);
    const unreadState = unreadStates.get(conversation.id);

    return {
      conversation: this.summaryFor(
        conversation,
        userId,
        isOnline,
        unreadState?.unreadCount ?? 0,
        unreadState?.lastReadMessageId ?? null,
        unreadState?.hidden ?? false
      ),
      ...messagePage,
    };
  }

  protected async messagePage(
    conversationId: number,
    beforeMessageId?: number
  ): Promise<ChatMessagePage> {
    const where = beforeMessageId
      ? { conversationId, id: LessThan(beforeMessageId) }
      : { conversationId };
    const persistedMessages = await this.sharedConn.getRepository(ChatMessageOrm).find({
      where,
      relations: [
        'senderUser',
        'attachments',
        'replyToMessage',
        'replyToMessage.senderUser',
        'replyToMessage.attachments',
      ],
      order: { id: 'DESC' },
      take: this.MESSAGES_PAGE_SIZE + 1,
    });
    const hasMoreMessages = persistedMessages.length > this.MESSAGES_PAGE_SIZE;
    const messages = persistedMessages.slice(0, this.MESSAGES_PAGE_SIZE);

    return {
      messages: messages.reverse().map(message => {
        return this.toChatMessage(message, undefined, message.senderUser.document);
      }),
      hasMoreMessages,
    };
  }

  protected summaryFor(
    conversation: ChatConversationOrm,
    userId: number,
    isOnline: (contactDocument: string) => boolean,
    unreadCount: number,
    lastReadMessageId: number | null,
    hidden: boolean
  ): ChatConversationSummary {
    const contact = this.otherParticipant(conversation, userId);
    if (!contact) throw new Error('Conversation without a contact');

    const lastMessage =
      conversation.lastMessageId && conversation.lastMessage && conversation.lastSenderUser
        ? {
            id: conversation.lastMessageId,
            conversationId: conversation.id,
            content: conversation.lastMessage.deletedAt
              ? ''
              : this.decryptMessageContent(conversation.lastMessage),
            attachments: conversation.lastMessage.deletedAt
              ? []
              : this.toAttachmentPaths(conversation.lastMessage.attachments),
            replyTo: conversation.lastMessage.deletedAt
              ? null
              : this.toChatMessageReply(conversation.lastMessage.replyToMessage),
            editedAt: this.toNullableIsoString(conversation.lastMessage.editedAt),
            deletedAt: this.toNullableIsoString(conversation.lastMessage.deletedAt),
            createdAt: this.toIsoString(conversation.lastMessage.createdAt),
            sender: this.toChatUser(conversation.lastSenderUser),
          }
        : null;

    return {
      id: conversation.id,
      contact: {
        document: contact.document,
        name: contact.name,
        online: isOnline(contact.document),
      },
      lastMessage,
      lastReadMessageId,
      unreadCount,
      hidden,
      updatedAt: this.toIsoString(conversation.updatedAt),
    };
  }

  protected async markConversationReadFor(
    conversation: ChatConversationOrm,
    userId: number
  ): Promise<void> {
    const lastMessageId = Number(conversation.lastMessageId ?? 0);
    if (!lastMessageId) return;

    await this.sharedConn.transaction('SERIALIZABLE', async manager => {
      const repository = manager.getRepository(ChatConversationReadOrm);
      const existing = await repository.findOne({
        where: { conversationId: conversation.id, userId },
      });
      if (Number(existing?.lastReadMessageId ?? 0) >= lastMessageId) return;

      await repository.save(
        repository.create({
          ...existing,
          conversationId: conversation.id,
          userId,
          lastReadMessageId: lastMessageId,
          updatedAt: new Date(),
        })
      );
    });
  }

  protected async unreadStatesFor(
    userId: number,
    conversationIds: number[]
  ): Promise<Map<number, ChatUnreadState>> {
    if (!conversationIds.length) return new Map();

    const rows = await this.sharedConn
      .getRepository(ChatConversationOrm)
      .createQueryBuilder('conversation')
      .leftJoin(
        ChatConversationReadOrm,
        'reading',
        'reading.conversationId = conversation.id AND reading.userId = :userId',
        { userId }
      )
      .leftJoin(
        ChatMessageOrm,
        'unreadMessage',
        [
          'unreadMessage.conversationId = conversation.id',
          'unreadMessage.recipientUserId = :userId',
          'unreadMessage.deletedAt IS NULL',
          'unreadMessage.id > COALESCE(reading.lastReadMessageId, 0)',
        ].join(' AND '),
        { userId }
      )
      .select('conversation.id', 'conversationId')
      .addSelect('reading.lastReadMessageId', 'lastReadMessageId')
      .addSelect('reading.hiddenAt', 'hiddenAt')
      .addSelect('COUNT(unreadMessage.id)', 'unreadCount')
      .where('conversation.id IN (:...conversationIds)', { conversationIds })
      .groupBy('conversation.id')
      .addGroupBy('reading.lastReadMessageId')
      .addGroupBy('reading.hiddenAt')
      .getRawMany<{
        conversationId: number | string;
        lastReadMessageId: number | string | null;
        hiddenAt: Date | string | null;
        unreadCount: number | string;
      }>();

    return new Map(
      rows.map(row => [
        Number(row.conversationId),
        {
          lastReadMessageId: row.lastReadMessageId == null ? null : Number(row.lastReadMessageId),
          unreadCount: Number(row.unreadCount),
          hidden: row.hiddenAt != null,
        },
      ])
    );
  }

  protected participantsFrom(conversation: ChatConversationOrm): RegisteredChatUser[] {
    if (!conversation.firstUser || !conversation.secondUser) {
      throw new Error('Conversation users were not loaded');
    }

    return [
      this.toRegisteredChatUser(conversation.firstUser),
      this.toRegisteredChatUser(conversation.secondUser),
    ];
  }

  protected otherParticipant(
    conversation: ChatConversationOrm,
    userId: number
  ): RegisteredChatUser | undefined {
    const participants = this.participantsFrom(conversation);
    if (conversation.firstUserId === userId) return participants[1];
    if (conversation.secondUserId === userId) return participants[0];
    return undefined;
  }

  protected hasParticipant(conversation: ChatConversationOrm, userId: number): boolean {
    return conversation.firstUserId === userId || conversation.secondUserId === userId;
  }

  protected messageMutationErrorFor(
    message: ChatMessageOrm | null,
    currentUserId: number
  ): ChatMessageMutationError | undefined {
    if (!message) return 'not-found';
    if (message.senderUserId !== currentUserId) return 'forbidden';
    if (message.deletedAt) return 'deleted';

    const createdAt = new Date(message.createdAt).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > CHAT_MESSAGE_MUTATION_WINDOW_MS) {
      return 'expired';
    }

    return undefined;
  }

  protected findConversationById(id: number): Promise<ChatConversationOrm | null> {
    return this.sharedConn.getRepository(ChatConversationOrm).findOne({
      where: { id },
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
    });
  }

  protected toRegisteredChatUser(user: {
    id: number;
    document: string;
    fullName: string;
  }): RegisteredChatUser {
    return {
      id: Number(user.id),
      document: normalizeDocument(String(user.document ?? '')),
      name: String(user.fullName ?? '').trim(),
    };
  }

  protected toChatUser(user: { document: string; fullName: string }): ChatUser {
    return {
      document: normalizeDocument(String(user.document ?? '')),
      name: String(user.fullName ?? '').trim(),
    };
  }

  protected toChatMessage(
    message: ChatMessageOrm,
    sender?: RegisteredChatUser,
    document?: string
  ): ChatMessage {
    const publicSender = sender
      ? { document: sender.document, name: sender.name }
      : this.toChatUser(message.senderUser);

    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.deletedAt ? '' : this.decryptMessageContent(message),
      attachments: message.deletedAt ? [] : this.toAttachmentPaths(message.attachments, document),
      replyTo: message.deletedAt ? null : this.toChatMessageReply(message.replyToMessage),
      editedAt: this.toNullableIsoString(message.editedAt),
      deletedAt: this.toNullableIsoString(message.deletedAt),
      createdAt: this.toIsoString(message.createdAt),
      sender: publicSender,
    };
  }

  protected toChatMessageReply(message?: ChatMessageOrm | null): ChatMessageReply | null {
    if (!message?.senderUser) return null;

    return {
      id: message.id,
      content: message.deletedAt ? '' : this.decryptMessageContent(message),
      attachments: message.deletedAt
        ? []
        : this.toAttachmentPaths(message.attachments, message.senderUser.document),
      deletedAt: this.toNullableIsoString(message.deletedAt),
      sender: this.toChatUser(message.senderUser),
    };
  }

  protected decryptMessageContent(message: ChatMessageOrm): string {
    return CRYPTO_CHAT_SERVICES.decrypt(message.content);
  }

  protected toAttachmentPaths(
    attachments?: ChatMessageAttachmentOrm[],
    document?: string
  ): string[] {
    return [...(attachments ?? [])]
      .sort((left, right) => left.id - right.id)
      .map(
        attachment =>
          `public/${FILE_PATHS.chat.files}/${document ? `${document}/` : ''}${attachment.path}`
      );
  }

  protected toIsoString(value: Date): string {
    return new Date(value).toISOString();
  }

  protected toNullableIsoString(value?: Date | null): string | null {
    return value ? this.toIsoString(value) : null;
  }
}
