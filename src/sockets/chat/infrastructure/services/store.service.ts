import { Injectable } from '@nestjs/common';
import { LessThan } from 'typeorm';
import { GCM_CONTEXTS } from '@common/domain/types';
import { switchConn } from '@common/infrastructure/services';
import { ChatConversationOrm } from '../orm/conversation.orm';
import { ChatConversationReadOrm } from '../orm/conversation-read.orm';
import { ChatMessageAttachmentOrm } from '../orm/message-attachment.orm';
import { ChatMessageOrm } from '../orm/message.orm';
import type {
  ChatConversationDetails,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
  ChatMessageReply,
  ChatUser,
  RegisteredChatUser,
} from '../../domain/types/types';
import { CHAT_MESSAGE_MUTATION_WINDOW_MS, normalizeDocument } from '../../domain/types/types';
import { FILE_PATHS } from '../../../../file-saver/locations';
import { CRYPTO_CHAT_SERVICES } from '@common/application/services';

interface ChatUnreadState {
  lastReadMessageId: number | null;
  unreadCount: number;
}

export class ChatReplyMessageNotFoundError extends Error {
  constructor() {
    super('Reply message not found in conversation');
    this.name = 'ChatReplyMessageNotFoundError';
  }
}

export type ChatMessageMutationError = 'not-found' | 'forbidden' | 'expired' | 'deleted' | 'empty';

export type ChatMessageMutationResult =
  { ok: true; message: ChatMessage } | { ok: false; error: ChatMessageMutationError };

@Injectable()
export class ChatStoreService {
  private static readonly MESSAGES_PAGE_SIZE = 30;
  private readonly sharedConn = switchConn(GCM_CONTEXTS.EKLIPSE);

  async start(
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

  async open(
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

  async markConversationRead(
    conversationId: number,
    currentUser: RegisteredChatUser
  ): Promise<boolean | undefined> {
    const conversation = await this.findConversationById(conversationId);
    if (!conversation || !this.hasParticipant(conversation, currentUser.id)) return undefined;

    await this.markConversationReadFor(conversation, currentUser.id);
    return true;
  }

  async loadPreviousMessages(
    conversationId: number,
    currentUser: RegisteredChatUser,
    beforeMessageId: number
  ): Promise<ChatMessagePage | undefined> {
    const conversation = await this.findConversationById(conversationId);
    if (!conversation || !this.hasParticipant(conversation, currentUser.id)) return undefined;

    return this.messagePage(conversationId, beforeMessageId);
  }

  async addMessage(
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

      return this.toChatMessage(
        message,
        currentUser,
        attachments.length ? attachments[0].split('/').at(-2) : null
      );
    });
  }

  async editMessage(
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

  async deleteMessage(
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

  async listFor(
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

    return conversations.map(conversation => {
      const unreadState = unreadStates.get(conversation.id);
      return this.summaryFor(
        conversation,
        userId,
        isOnline,
        unreadState?.unreadCount ?? 0,
        unreadState?.lastReadMessageId ?? null
      );
    });
  }

  async unreadCountFor(userId: number): Promise<number> {
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

  async participants(conversationId: number): Promise<RegisteredChatUser[]> {
    const conversation = await this.sharedConn.getRepository(ChatConversationOrm).findOne({
      where: { id: conversationId },
      relations: ['firstUser', 'secondUser'],
    });
    return conversation ? this.participantsFrom(conversation) : [];
  }

  async peersFor(userId: number): Promise<RegisteredChatUser[]> {
    const conversations = await this.sharedConn.getRepository(ChatConversationOrm).find({
      where: [{ firstUserId: userId }, { secondUserId: userId }],
      relations: ['firstUser', 'secondUser'],
    });
    const peers = new Map<number, RegisteredChatUser>();

    for (const conversation of conversations) {
      const peer = this.otherParticipant(conversation, userId);
      if (peer) peers.set(peer.id, peer);
    }

    return [...peers.values()];
  }

  private async detailsFor(
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
        unreadState?.lastReadMessageId ?? null
      ),
      ...messagePage,
    };
  }

  private async messagePage(
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
      take: ChatStoreService.MESSAGES_PAGE_SIZE + 1,
    });
    const hasMoreMessages = persistedMessages.length > ChatStoreService.MESSAGES_PAGE_SIZE;
    const messages = persistedMessages.slice(0, ChatStoreService.MESSAGES_PAGE_SIZE);

    return {
      messages: messages.reverse().map(message => {
        return this.toChatMessage(message, undefined, message.senderUser.document);
      }),
      hasMoreMessages,
    };
  }

  private summaryFor(
    conversation: ChatConversationOrm,
    userId: number,
    isOnline: (contactDocument: string) => boolean,
    unreadCount: number,
    lastReadMessageId: number | null
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
      updatedAt: this.toIsoString(conversation.updatedAt),
    };
  }

  private async markConversationReadFor(
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

  private async unreadStatesFor(
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
        'reading.CHATCONVERSACION = conversation.OID AND reading.CHATUSUREG = :userId',
        { userId }
      )
      .leftJoin(
        ChatMessageOrm,
        'unreadMessage',
        `unreadMessage.CHATCONVERSACION = conversation.OID
          AND unreadMessage.CHATUSUREG2 = :userId
          AND unreadMessage.FECELI IS NULL
          AND unreadMessage.OID > COALESCE(reading.CHATMENSAJE, 0)`,
        { userId }
      )
      .select('conversation.OID', 'conversationId')
      .addSelect('reading.CHATMENSAJE', 'lastReadMessageId')
      .addSelect('COUNT(unreadMessage.OID)', 'unreadCount')
      .where('conversation.OID IN (:...conversationIds)', { conversationIds })
      .groupBy('conversation.OID')
      .addGroupBy('reading.CHATMENSAJE')
      .getRawMany<{
        conversationId: number | string;
        lastReadMessageId: number | string | null;
        unreadCount: number | string;
      }>();

    return new Map(
      rows.map(row => [
        Number(row.conversationId),
        {
          lastReadMessageId: row.lastReadMessageId == null ? null : Number(row.lastReadMessageId),
          unreadCount: Number(row.unreadCount),
        },
      ])
    );
  }

  private participantsFrom(conversation: ChatConversationOrm): RegisteredChatUser[] {
    if (!conversation.firstUser || !conversation.secondUser) {
      throw new Error('Conversation users were not loaded');
    }

    return [
      this.toRegisteredChatUser(conversation.firstUser),
      this.toRegisteredChatUser(conversation.secondUser),
    ];
  }

  private otherParticipant(
    conversation: ChatConversationOrm,
    userId: number
  ): RegisteredChatUser | undefined {
    const participants = this.participantsFrom(conversation);
    if (conversation.firstUserId === userId) return participants[1];
    if (conversation.secondUserId === userId) return participants[0];
    return undefined;
  }

  private hasParticipant(conversation: ChatConversationOrm, userId: number): boolean {
    return conversation.firstUserId === userId || conversation.secondUserId === userId;
  }

  private messageMutationErrorFor(
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

  private findConversationById(id: number): Promise<ChatConversationOrm | null> {
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

  private toRegisteredChatUser(user: {
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

  private toChatUser(user: { document: string; fullName: string }): ChatUser {
    return {
      document: normalizeDocument(String(user.document ?? '')),
      name: String(user.fullName ?? '').trim(),
    };
  }

  private toChatMessage(
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

  private toChatMessageReply(message?: ChatMessageOrm | null): ChatMessageReply | null {
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

  private decryptMessageContent(message: ChatMessageOrm): string {
    return CRYPTO_CHAT_SERVICES.decrypt(message.content);
  }

  private toAttachmentPaths(attachments?: ChatMessageAttachmentOrm[], document?: string): string[] {
    return [...(attachments ?? [])]
      .sort((left, right) => left.id - right.id)
      .map(
        attachment =>
          `public/${FILE_PATHS.chat.files}/${document ? `${document}/` : ''}${attachment.path}`
      );
  }

  private toIsoString(value: Date): string {
    return new Date(value).toISOString();
  }

  private toNullableIsoString(value?: Date | null): string | null {
    return value ? this.toIsoString(value) : null;
  }
}
