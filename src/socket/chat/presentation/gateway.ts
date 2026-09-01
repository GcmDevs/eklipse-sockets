import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatContact,
  ChatConversationDetails,
  ChatConversationHidden,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
  ChatPinPayload,
  ChatSecurityState,
  ChatSecurityUnlockDetails,
  ChatTypingPayload,
  DeleteChatMessagePayload,
  EditChatMessagePayload,
  HideChatConversationPayload,
  LoadPreviousChatMessagesPayload,
  OpenConversationPayload,
  SearchChatUsersPayload,
  SendChatMessagePayload,
  StartConversationPayload,
} from '@socket/chat/domain/types';
import { SOCKET_EVENTS } from '@socket/common/events';
import { SOCKET_GATEWAY_OPTIONS } from '@socket/common/constants';
import { DisableSecurityImpl } from './gtw-disable-security';
import { DeleteMessageImpl } from './gtw-delete-message';
import { EditMessageImpl } from './gtw-edit-message';
import { EnableSecurityImpl } from './gtw-enable-security';
import { HandleDisconnectImpl } from './gtw-handle-disconnect';
import { handleConnectionImpl } from './gtw-handle-connection';
import { HideConversationImpl } from './gtw-hide-conversation';
import { LoadPreviousMessagesImpl } from './gtw-load-previous-messages';
import { LockSecurityImpl } from './gtw-lock-security';
import { MarkConversationReadImpl } from './gtw-mark-conversation-read';
import { OpenConversationImpl } from './gtw-open-conversation';
import { SearchUsersImpl } from './gtw-search-users';
import { SecurityActivityImpl } from './gtw-security-activity';
import { SendMessageImpl } from './gtw-send-message';
import { StartConversationImpl } from './gtw-start-conversation';
import { UnlockSecurityImpl } from './gtw-unlock-security';
import { UpdateTypingImpl } from './gtw-update-typing';

@WebSocketGateway(SOCKET_GATEWAY_OPTIONS)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly _handleConnection: handleConnectionImpl,
    private readonly _handleDisconnect: HandleDisconnectImpl,
    private readonly _enableSecurity: EnableSecurityImpl,
    private readonly _unlockSecurity: UnlockSecurityImpl,
    private readonly _disableSecurity: DisableSecurityImpl,
    private readonly _lockSecurity: LockSecurityImpl,
    private readonly _securityActivity: SecurityActivityImpl,
    private readonly _searchUsers: SearchUsersImpl,
    private readonly _startConversation: StartConversationImpl,
    private readonly _openConversation: OpenConversationImpl,
    private readonly _markConversationRead: MarkConversationReadImpl,
    private readonly _hideConversation: HideConversationImpl,
    private readonly _loadPreviousMessages: LoadPreviousMessagesImpl,
    private readonly _updateTyping: UpdateTypingImpl,
    private readonly _sendMessage: SendMessageImpl,
    private readonly _editMessage: EditMessageImpl,
    private readonly _deleteMessage: DeleteMessageImpl
  ) {}

  handleConnection(client: Socket): Promise<void> {
    return this._handleConnection.execute(client);
  }

  handleDisconnect(client: Socket): void {
    this._handleDisconnect.execute(client);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.enableSecurity)
  enableSecurity(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatPinPayload
  ): Promise<ChatActionAck<ChatSecurityState>> {
    return this._enableSecurity.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.unlockSecurity)
  unlockSecurity(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatPinPayload
  ): Promise<ChatActionAck<ChatSecurityUnlockDetails>> {
    return this._unlockSecurity.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.disableSecurity)
  disableSecurity(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatPinPayload
  ): Promise<ChatActionAck<ChatSecurityState>> {
    return this._disableSecurity.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.lockSecurity)
  lockSecurity(@ConnectedSocket() client: Socket): ChatActionAck<ChatSecurityState> {
    return this._lockSecurity.execute(client);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.securityActivity)
  securityActivity(@ConnectedSocket() client: Socket): ChatActionAck<ChatSecurityState> {
    return this._securityActivity.execute(client);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.searchUsers)
  searchUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SearchChatUsersPayload
  ): Promise<ChatActionAck<ChatContact[]>> {
    return this._searchUsers.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.startConversation)
  startConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StartConversationPayload
  ): Promise<ChatActionAck<ChatConversationDetails>> {
    return this._startConversation.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.openConversation)
  openConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: OpenConversationPayload
  ): Promise<ChatActionAck<ChatConversationDetails>> {
    return this._openConversation.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.markConversationRead)
  markConversationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: OpenConversationPayload
  ): Promise<ChatActionAck<ChatConversationSummary>> {
    return this._markConversationRead.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.hideConversation)
  hideConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: HideChatConversationPayload
  ): Promise<ChatActionAck<ChatConversationHidden>> {
    return this._hideConversation.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.loadPreviousMessages)
  loadPreviousMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadPreviousChatMessagesPayload
  ): Promise<ChatActionAck<ChatMessagePage>> {
    return this._loadPreviousMessages.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.typing)
  updateTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatTypingPayload
  ): Promise<void> {
    return this._updateTyping.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.sendMessage)
  sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendChatMessagePayload
  ): Promise<ChatActionAck<ChatMessage>> {
    return this._sendMessage.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.editMessage)
  editMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EditChatMessagePayload
  ): Promise<ChatActionAck<ChatMessage>> {
    return this._editMessage.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.deleteMessage)
  deleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: DeleteChatMessagePayload
  ): Promise<ChatActionAck<ChatMessage>> {
    return this._deleteMessage.execute(client, payload);
  }
}
