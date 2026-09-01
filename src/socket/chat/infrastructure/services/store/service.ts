import { Injectable } from '@nestjs/common';
import type {
  ChatConversationDetails,
  ChatConversationHidden,
  ChatConversationSummary,
  ChatMessage,
  ChatMessageMutationResult,
  ChatMessagePage,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { ChatAddMessageImpl } from './svc-add-message';
import { ChatDeleteMessageImpl } from './svc-delete-message';
import { ChatEditMessageImpl } from './svc-edit-message';
import { ChatHideConversationImpl } from './svc-hide-conversation';
import { ChatListForImpl } from './svc-list-for';
import { ChatLoadPreviousMessagesImpl } from './svc-load-previous-messages';
import { ChatMarkConversationReadImpl } from './svc-mark-conversation-read';
import { ChatOpenImpl } from './svc-open';
import { ChatParticipantsImpl } from './svc-participants';
import { ChatPeersForImpl } from './svc-peers-for';
import { ChatStartImpl } from './svc-start';
import { ChatUnreadCountForImpl } from './unread-count-for';

@Injectable()
export class ChatStoreService {
  constructor(
    private readonly _start: ChatStartImpl,
    private readonly _open: ChatOpenImpl,
    private readonly _markConversationRead: ChatMarkConversationReadImpl,
    private readonly _hideConversation: ChatHideConversationImpl,
    private readonly _loadPreviousMessages: ChatLoadPreviousMessagesImpl,
    private readonly _addMessage: ChatAddMessageImpl,
    private readonly _editMessage: ChatEditMessageImpl,
    private readonly _deleteMessage: ChatDeleteMessageImpl,
    private readonly _listFor: ChatListForImpl,
    private readonly _unreadCountFor: ChatUnreadCountForImpl,
    private readonly _participants: ChatParticipantsImpl,
    private readonly _peersFor: ChatPeersForImpl
  ) {}

  async start(
    currentUser: RegisteredChatUser,
    contact: RegisteredChatUser,
    isOnline: (document: string) => boolean
  ): Promise<ChatConversationDetails> {
    return this._start.execute(currentUser, contact, isOnline);
  }

  async open(
    conversationId: number,
    currentUser: RegisteredChatUser,
    isOnline: (document: string) => boolean,
    markAsRead = true
  ): Promise<ChatConversationDetails | undefined> {
    return this._open.execute(conversationId, currentUser, isOnline, markAsRead);
  }

  async markConversationRead(
    conversationId: number,
    currentUser: RegisteredChatUser
  ): Promise<boolean | undefined> {
    return this._markConversationRead.execute(conversationId, currentUser);
  }

  async hideConversation(
    conversationId: number,
    currentUser: RegisteredChatUser
  ): Promise<ChatConversationHidden | undefined> {
    return this._hideConversation.execute(conversationId, currentUser);
  }

  async loadPreviousMessages(
    conversationId: number,
    currentUser: RegisteredChatUser,
    beforeMessageId: number
  ): Promise<ChatMessagePage | undefined> {
    return this._loadPreviousMessages.execute(conversationId, currentUser, beforeMessageId);
  }

  async addMessage(
    conversationId: number,
    currentUser: RegisteredChatUser,
    content: string,
    attachments: string[],
    replyToMessageId?: number
  ): Promise<ChatMessage | undefined> {
    return this._addMessage.execute(
      conversationId,
      currentUser,
      content,
      attachments,
      replyToMessageId
    );
  }

  async editMessage(
    messageId: number,
    currentUser: RegisteredChatUser,
    content: string
  ): Promise<ChatMessageMutationResult> {
    return this._editMessage.execute(messageId, currentUser, content);
  }

  async deleteMessage(
    messageId: number,
    currentUser: RegisteredChatUser
  ): Promise<ChatMessageMutationResult> {
    return this._deleteMessage.execute(messageId, currentUser);
  }

  async listFor(
    userId: number,
    isOnline: (contactDocument: string) => boolean
  ): Promise<ChatConversationSummary[]> {
    return this._listFor.execute(userId, isOnline);
  }

  async unreadCountFor(userId: number): Promise<number> {
    return this._unreadCountFor.execute(userId);
  }

  async participants(conversationId: number): Promise<RegisteredChatUser[]> {
    return this._participants.execute(conversationId);
  }

  async peersFor(userId: number): Promise<RegisteredChatUser[]> {
    return this._peersFor.execute(userId);
  }
}
