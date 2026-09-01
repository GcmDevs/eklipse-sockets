import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { ChatMessageMutationError } from '@socket/chat/infrastructure/services';
import type {
  ChatActionAck,
  ChatBootstrap,
  ChatContact,
  ChatConversationDetails,
  ChatConversationHidden,
  ChatConversationSummary,
  DeleteChatMessagePayload,
  EditChatMessagePayload,
  ChatMessage,
  ChatMessagePage,
  ChatNotificationState,
  ChatOnlineUsersCount,
  ChatPinPayload,
  ChatPresence,
  ChatSecurityState,
  ChatSecurityUnlockDetails,
  ChatTypingPayload,
  ChatTypingState,
  ChatUser,
  HideChatConversationPayload,
  LoadPreviousChatMessagesPayload,
  OpenConversationPayload,
  RegisteredChatUser,
  SearchChatUsersPayload,
  SendChatMessagePayload,
  StartConversationPayload,
} from '@socket/chat/domain/types';
import { processEnv } from '@env';
import { SOCKET_EVENTS } from '@common/application/events';
import {
  ChatReplyMessageNotFoundError,
  ChatStoreService,
  ChatDirectoryService,
  ChatSecurityService,
} from '@socket/chat/infrastructure/services';
import { normalizeDocument } from '@socket/chat/domain/types';
import { promises as fs } from 'fs';
import {
  FILE_PATHS,
  MAX_CHAT_FILES_PER_MESSAGE,
  isManagedStoredFilePath,
  normalizeStoredFilePath,
  resolveStoredPublicFile,
} from '@file-saver/locations';
import { VALID_HOSTS } from '../app.environments';
import { FileServerRegistry } from '@file-saver/registry';
import { ADMINS, ALTOS_MANDOS, CAN_TALK_WITH_ALTOS_MANDOS } from '@common/application/constants';

const ONLINE_USERS_COUNT_ALLOWED_DOCUMENTS = new Set(ADMINS);
const ALTOS_MANDOS_DOCUMENTS = new Set(ALTOS_MANDOS.map(normalizeDocument));
const CAN_TALK_WITH_ALTOS_MANDOS_DOCUMENTS = new Set(
  CAN_TALK_WITH_ALTOS_MANDOS.map(normalizeDocument)
);
const CHAT_SECURITY_LOCK_DELAY_MS = 10 * 60 * 1000;

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: VALID_HOSTS },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private static readonly MAX_MESSAGE_LENGTH = 10000;
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private server: Namespace;

  private readonly connectedUsers = new Map<string, number>();
  private readonly connectedClients = new Map<string, Set<Socket>>();
  private readonly securityLockTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly directory: ChatDirectoryService,
    private readonly security: ChatSecurityService,
    private readonly store: ChatStoreService,
    private readonly fileRegistry: FileServerRegistry
  ) {}

  afterInit(server: Namespace): void {
    server.use(async (client, next) => {
      let tokenUser: ChatUser;
      try {
        tokenUser = this.authenticate(client);
      } catch {
        next(new Error('Tu sesión no es válida. Inicia sesión nuevamente.'));
        return;
      }

      try {
        const registeredUser = await this.directory.findByDocument(tokenUser.document);
        if (!registeredUser) {
          next(new Error('Tu usuario no está registrado para utilizar el chat.'));
          return;
        }

        client.data.chatUser = registeredUser;
        next();
      } catch {
        next(new Error('No fue posible validar tu acceso al chat. Intenta nuevamente.'));
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const user = client.data.chatUser as RegisteredChatUser;
    client.data.chatSecurityEnabled = true;
    client.data.chatSecurityUnlocked = false;
    client.join(this.userRoom(user.document));
    this.registerClient(user.document, client);
    this.changeConnectionCount(user.document, 1);
    this.emitOnlineUsersCount();

    try {
      const securityEnabled = await this.security.isEnabled(user.id);
      client.data.chatSecurityEnabled = securityEnabled;
      client.data.chatSecurityUnlocked = !securityEnabled;
      await this.emitBootstrap(client, user);
    } catch (error) {
      client.data.chatSecurityEnabled = true;
      client.data.chatSecurityUnlocked = false;
      this.logPersistenceError('cargar la seguridad y las conversaciones', error);
      client.emit('exception', {
        message: 'No fue posible validar la seguridad del chat.',
      });
      client.emit(SOCKET_EVENTS.chat.bootstrap, {
        conversations: [],
        notifications: { unreadCount: 0 },
        security: this.securityStateFor(client),
      } satisfies ChatBootstrap);
    }
    void this.emitPresence(user);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.enableSecurity)
  async enableSecurity(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatPinPayload
  ): Promise<ChatActionAck<ChatSecurityState>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();

    const pin = typeof payload?.pin === 'string' ? payload.pin : '';
    if (!this.security.isValidPin(pin)) {
      return { ok: false, error: 'El PIN debe contener exactamente 4 números.' };
    }

    try {
      if ((await this.security.isEnabled(currentUser.id)) && this.isChatLocked(client)) {
        return this.chatLocked();
      }
      await this.security.enable(currentUser.id, pin);
      client.data.chatSecurityEnabled = true;
      client.data.chatSecurityUnlocked = true;
      this.touchSecurityActivity(client);
      this.syncSecurityWithOtherClients(client, currentUser, true);
      return { ok: true, data: this.securityStateFor(client) };
    } catch (error) {
      this.logPersistenceError('activar la seguridad del chat', error);
      return { ok: false, error: 'No fue posible activar la protección del chat.' };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.unlockSecurity)
  async unlockSecurity(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatPinPayload
  ): Promise<ChatActionAck<ChatSecurityUnlockDetails>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();

    try {
      if (!(await this.security.isEnabled(currentUser.id))) {
        client.data.chatSecurityEnabled = false;
        client.data.chatSecurityUnlocked = true;
      } else {
        const pin = typeof payload?.pin === 'string' ? payload.pin : '';
        const verification = await this.security.verify(currentUser.id, pin);
        if (!verification.valid) {
          return {
            ok: false,
            error: verification.retryAfterSeconds
              ? `Demasiados intentos. Espera ${verification.retryAfterSeconds} segundos.`
              : 'El PIN no es correcto.',
            retryAfterSeconds: verification.retryAfterSeconds,
          };
        }
        client.data.chatSecurityEnabled = true;
        client.data.chatSecurityUnlocked = true;
        this.touchSecurityActivity(client);
      }

      const bootstrap = await this.bootstrapFor(client, currentUser);
      return {
        ok: true,
        data: { security: this.securityStateFor(client), bootstrap },
      };
    } catch (error) {
      this.logPersistenceError('desbloquear el chat', error);
      return { ok: false, error: 'No fue posible validar el PIN.' };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.disableSecurity)
  async disableSecurity(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatPinPayload
  ): Promise<ChatActionAck<ChatSecurityState>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();

    const pin = typeof payload?.pin === 'string' ? payload.pin : '';
    try {
      const verification = await this.security.disable(currentUser.id, pin);
      if (!verification.valid) {
        return {
          ok: false,
          error: verification.retryAfterSeconds
            ? `Demasiados intentos. Espera ${verification.retryAfterSeconds} segundos.`
            : 'El PIN no es correcto.',
          retryAfterSeconds: verification.retryAfterSeconds,
        };
      }

      client.data.chatSecurityEnabled = false;
      client.data.chatSecurityUnlocked = true;
      this.clearSecurityTimeout(client.id);
      this.syncSecurityWithOtherClients(client, currentUser, false);
      return { ok: true, data: this.securityStateFor(client) };
    } catch (error) {
      this.logPersistenceError('quitar la seguridad del chat', error);
      return { ok: false, error: 'No fue posible quitar la protección del chat.' };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.lockSecurity)
  lockSecurity(@ConnectedSocket() client: Socket): ChatActionAck<ChatSecurityState> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();

    this.lockClient(client);
    return { ok: true, data: this.securityStateFor(client) };
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.securityActivity)
  securityActivity(@ConnectedSocket() client: Socket): ChatActionAck<ChatSecurityState> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();

    this.touchSecurityActivity(client);
    return { ok: true, data: this.securityStateFor(client) };
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.searchUsers)
  async searchUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SearchChatUsersPayload
  ): Promise<ChatActionAck<ChatContact[]>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    this.touchSecurityActivity(client);

    const query = typeof payload?.query === 'string' ? payload.query.trim() : '';
    if (!query) return { ok: true, data: [] };
    if (query.length > 80) {
      return { ok: false, error: 'La búsqueda no puede superar 80 caracteres.' };
    }

    try {
      const excludedDocuments = this.canTalkWithAltosMandos(currentUser.document)
        ? []
        : ALTOS_MANDOS;
      const contacts = (
        await this.directory.search(query, currentUser.document, excludedDocuments)
      ).map(user => ({
        document: user.document,
        name: user.name,
        online: this.isOnline(user.document),
      }));

      return { ok: true, data: contacts };
    } catch {
      return {
        ok: false,
        error: 'No fue posible buscar usuarios. Verifica la conexión e intenta nuevamente.',
      };
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.chatUser as RegisteredChatUser | undefined;
    if (!user) return;

    void this.stopClientTyping(client, user);
    this.unregisterClient(user.document, client);
    this.clearSecurityTimeout(client.id);
    this.changeConnectionCount(user.document, -1);
    this.emitOnlineUsersCount();
    void this.emitPresence(user);
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.startConversation)
  async startConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StartConversationPayload
  ): Promise<ChatActionAck<ChatConversationDetails>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    await this.stopClientTyping(client, currentUser);
    this.touchSecurityActivity(client);

    let registeredCurrentUser: RegisteredChatUser | undefined;
    let contact: RegisteredChatUser | undefined;
    try {
      [registeredCurrentUser, contact] = await Promise.all([
        this.directory.findByDocument(currentUser.document),
        this.directory.findByDocument(payload?.document),
      ]);
    } catch {
      return {
        ok: false,
        error: 'No fue posible consultar el directorio de usuarios. Intenta nuevamente.',
      };
    }
    if (!registeredCurrentUser || registeredCurrentUser.id !== currentUser.id) {
      return { ok: false, error: 'Tu usuario ya no está registrado para utilizar el chat.' };
    }
    if (!contact) return { ok: false, error: 'No encontramos un usuario con ese documento.' };
    if (
      ALTOS_MANDOS_DOCUMENTS.has(normalizeDocument(contact.document)) &&
      !this.canTalkWithAltosMandos(registeredCurrentUser.document)
    ) {
      return { ok: false, error: 'No encontramos un usuario con ese documento.' };
    }
    if (contact.id === registeredCurrentUser.id) {
      return { ok: false, error: 'No puedes iniciar una conversación contigo mismo.' };
    }

    try {
      const details = await this.store.start(registeredCurrentUser, contact, document =>
        this.isOnline(document)
      );
      void this.emitConversationUpdate(details.conversation.id);
      return { ok: true, data: details };
    } catch (error) {
      this.logPersistenceError('crear una conversación', error);
      return { ok: false, error: 'No fue posible guardar la conversación.' };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.openConversation)
  async openConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: OpenConversationPayload
  ): Promise<ChatActionAck<ChatConversationDetails>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    await this.stopClientTyping(client, currentUser);
    this.touchSecurityActivity(client);

    if (!payload.conversationId) return { ok: false, error: 'La conversación no es válida.' };

    try {
      const markAsRead = payload.markAsRead !== false;
      const details = await this.store.open(
        payload.conversationId,
        currentUser,
        document => this.isOnline(document),
        markAsRead
      );
      if (!details) return { ok: false, error: 'No tienes acceso a esta conversación.' };

      if (markAsRead) {
        void Promise.all([
          this.emitSummaryToUser(currentUser.document, details.conversation),
          this.emitNotificationState(currentUser),
        ]).catch(error => this.logPersistenceError('actualizar las notificaciones', error));
      }

      return { ok: true, data: details };
    } catch (error) {
      this.logPersistenceError('abrir una conversación', error);
      return { ok: false, error: 'No fue posible cargar los mensajes guardados.' };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.markConversationRead)
  async markConversationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: OpenConversationPayload
  ): Promise<ChatActionAck<ChatConversationSummary>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    this.touchSecurityActivity(client);

    const conversationId = Number(payload?.conversationId);
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
      return { ok: false, error: 'La conversación no es válida.' };
    }

    try {
      const marked = await this.store.markConversationRead(conversationId, currentUser);
      if (!marked) return { ok: false, error: 'No tienes acceso a esta conversación.' };

      const summary = (
        await this.store.listFor(currentUser.id, document => this.isOnline(document))
      ).find(conversation => conversation.id === conversationId);
      if (!summary) return { ok: false, error: 'La conversación ya no está disponible.' };

      void Promise.all([
        this.emitSummaryToUser(currentUser.document, summary),
        this.emitNotificationState(currentUser),
      ]).catch(error => this.logPersistenceError('actualizar las notificaciones', error));
      return { ok: true, data: summary };
    } catch (error) {
      this.logPersistenceError('marcar una conversación como leída', error);
      return { ok: false, error: 'No fue posible actualizar la lectura de la conversación.' };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.hideConversation)
  async hideConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: HideChatConversationPayload
  ): Promise<ChatActionAck<ChatConversationHidden>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    await this.stopClientTyping(client, currentUser);
    this.touchSecurityActivity(client);

    const conversationId = Number(payload?.conversationId);
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
      return { ok: false, error: 'La conversación no es válida.' };
    }

    try {
      const data = await this.store.hideConversation(conversationId, currentUser);
      if (!data) return { ok: false, error: 'No tienes acceso a esta conversación.' };

      await Promise.all([
        this.emitToUnlockedUser(currentUser.document, SOCKET_EVENTS.chat.conversationHidden, data),
        this.emitNotificationState(currentUser),
      ]);
      return { ok: true, data };
    } catch (error) {
      this.logPersistenceError('ocultar una conversación', error);
      return { ok: false, error: 'No fue posible ocultar la conversación.' };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.loadPreviousMessages)
  async loadPreviousMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LoadPreviousChatMessagesPayload
  ): Promise<ChatActionAck<ChatMessagePage>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    this.touchSecurityActivity(client);

    const conversationId = payload?.conversationId;
    const beforeMessageId = payload?.beforeMessageId;
    if (
      !Number.isSafeInteger(conversationId) ||
      Number(conversationId) <= 0 ||
      !Number.isSafeInteger(beforeMessageId) ||
      Number(beforeMessageId) <= 0
    ) {
      return { ok: false, error: 'No fue posible identificar los mensajes anteriores.' };
    }

    try {
      const page = await this.store.loadPreviousMessages(
        Number(conversationId),
        currentUser,
        Number(beforeMessageId)
      );
      if (!page) return { ok: false, error: 'No tienes acceso a esta conversación.' };

      return { ok: true, data: page };
    } catch (error) {
      this.logPersistenceError('cargar mensajes anteriores', error);
      return { ok: false, error: 'No fue posible cargar los mensajes anteriores.' };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.typing)
  async updateTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatTypingPayload
  ): Promise<void> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return;
    if (this.isChatLocked(client)) {
      await this.stopClientTyping(client, currentUser);
      return;
    }

    const conversationId = Number(payload?.conversationId);
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return;

    try {
      if (payload?.typing === true) {
        await this.startClientTyping(client, currentUser, conversationId);
        this.touchSecurityActivity(client);
        return;
      }

      if (payload?.typing === false) await this.stopClientTyping(client, currentUser);
    } catch {
      await this.stopClientTyping(client, currentUser);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.sendMessage)
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendChatMessagePayload
  ): Promise<ChatActionAck<ChatMessage>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.rejectedMessage('No fue posible identificar tu sesión.');
    if (this.isChatLocked(client)) return this.chatLocked(true);
    await this.stopClientTyping(client, currentUser);
    this.touchSecurityActivity(client);

    const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
    const rawAttachments = payload?.attachments;
    const attachments = Array.isArray(rawAttachments)
      ? rawAttachments.map(value =>
          typeof value === 'string' ? normalizeStoredFilePath(value) : ''
        )
      : [];
    const rawReplyToMessageId = payload?.replyToMessageId;
    const replyToMessageId =
      rawReplyToMessageId === undefined || rawReplyToMessageId === null
        ? undefined
        : Number(rawReplyToMessageId);

    if (!payload.conversationId) return this.rejectedMessage('Selecciona una conversación.');
    if (rawAttachments !== undefined && !Array.isArray(rawAttachments)) {
      return this.rejectedMessage('Los archivos adjuntos no son válidos.');
    }
    if (attachments.length > MAX_CHAT_FILES_PER_MESSAGE) {
      return this.rejectedMessage(
        `Solo puedes enviar hasta ${MAX_CHAT_FILES_PER_MESSAGE} archivos por mensaje.`
      );
    }
    if (
      attachments.some(path => !isManagedStoredFilePath(path, FILE_PATHS.chat.files)) ||
      new Set(attachments).size !== attachments.length
    ) {
      return this.rejectedMessage('Los archivos adjuntos no son válidos.');
    }
    if (
      replyToMessageId !== undefined &&
      (!Number.isSafeInteger(replyToMessageId) || replyToMessageId <= 0)
    ) {
      return this.rejectedMessage('El mensaje que intentas responder no es válido.');
    }
    if (!content && attachments.length === 0) {
      return this.rejectedMessage('Escribe un mensaje o adjunta un archivo antes de enviarlo.');
    }
    if (content.length > ChatGateway.MAX_MESSAGE_LENGTH) {
      return this.rejectedMessage(
        `El mensaje no puede superar ${ChatGateway.MAX_MESSAGE_LENGTH} caracteres.`
      );
    }

    try {
      await Promise.all(attachments.map(path => fs.access(resolveStoredPublicFile(path))));

      const participants = await this.store.participants(payload.conversationId);
      if (!participants.some(participant => participant.id === currentUser.id)) {
        return this.rejectedMessage('No tienes acceso a esta conversación.');
      }

      const registeredParticipants = await this.directory.findByIds(
        participants.map(participant => participant.id)
      );
      if (registeredParticipants.length !== 2) {
        return this.rejectedMessage(
          'No se puede enviar el mensaje porque uno de los usuarios ya no está registrado.'
        );
      }

      const registeredCurrentUser = registeredParticipants.find(
        participant => participant.id === currentUser.id
      );
      if (!registeredCurrentUser || registeredCurrentUser.document !== currentUser.document) {
        return this.rejectedMessage('Tu usuario ya no está registrado para utilizar el chat.');
      }

      if (attachments.length && !this.fileRegistry.reserve(attachments, currentUser.document)) {
        return this.rejectedMessage('Los archivos adjuntos ya no están disponibles.');
      }

      const message = await this.store.addMessage(
        payload.conversationId,
        registeredCurrentUser,
        content,
        attachments,
        replyToMessageId
      );
      if (!message) {
        this.fileRegistry.release(attachments, currentUser.document);
        return this.rejectedMessage('No tienes acceso a esta conversación.');
      }

      this.fileRegistry.complete(attachments, currentUser.document);

      await this.emitConversationUpdate(payload.conversationId);
      await Promise.all(
        registeredParticipants.map(participant =>
          this.emitToUnlockedUser(participant.document, SOCKET_EVENTS.chat.message, message)
        )
      );

      return { ok: true, data: message };
    } catch (error) {
      this.fileRegistry.release(attachments, currentUser.document);
      if (error instanceof ChatReplyMessageNotFoundError) {
        return this.rejectedMessage(
          'El mensaje que intentas responder ya no está disponible en esta conversación.'
        );
      }
      this.logPersistenceError('guardar un mensaje', error);
      return this.rejectedMessage('No fue posible guardar el mensaje. Intenta nuevamente.');
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.editMessage)
  async editMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EditChatMessagePayload
  ): Promise<ChatActionAck<ChatMessage>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    this.touchSecurityActivity(client);

    const messageId = Number(payload?.messageId);
    const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      return this.rejectedMutation('No fue posible identificar el mensaje.');
    }
    if (content.length > ChatGateway.MAX_MESSAGE_LENGTH) {
      return this.rejectedMutation(
        `El mensaje no puede superar ${ChatGateway.MAX_MESSAGE_LENGTH} caracteres.`
      );
    }

    try {
      const result = await this.store.editMessage(messageId, currentUser, content);
      if (result.ok === false) {
        return this.rejectedMutation(this.messageMutationError(result.error));
      }

      await this.emitMessageMutation(result.message);
      return { ok: true, data: result.message };
    } catch (error) {
      this.logPersistenceError('editar un mensaje', error);
      return this.rejectedMutation('No fue posible editar el mensaje. Intenta nuevamente.');
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chat.deleteMessage)
  async deleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: DeleteChatMessagePayload
  ): Promise<ChatActionAck<ChatMessage>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    this.touchSecurityActivity(client);

    const messageId = Number(payload?.messageId);
    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      return this.rejectedMutation('No fue posible identificar el mensaje.');
    }

    try {
      const result = await this.store.deleteMessage(messageId, currentUser);
      if (result.ok === false) {
        return this.rejectedMutation(this.messageMutationError(result.error));
      }

      await this.emitMessageMutation(result.message);
      return { ok: true, data: result.message };
    } catch (error) {
      this.logPersistenceError('eliminar un mensaje', error);
      return this.rejectedMutation('No fue posible eliminar el mensaje. Intenta nuevamente.');
    }
  }

  private authenticate(client: Socket): ChatUser {
    const tokenFromAuth = client.handshake.auth?.token;
    const authorization = client.handshake.headers.authorization;
    const tokenFromHeader = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    const token = typeof tokenFromAuth === 'string' ? tokenFromAuth : tokenFromHeader;

    if (!token) throw new Error('Token not found');

    const decoded = (
      processEnv.PRODUCTION ? jwt.verify(token, processEnv.JWT_SECRET_KEY) : jwt.decode(token)
    ) as JwtPayload | null;

    const document = normalizeDocument(decoded?.dcm);
    const name = typeof decoded?.fnm === 'string' ? decoded.fnm.trim() : '';
    if (!decoded?.jti || !decoded?.sub || !document || !name) {
      throw new Error('Invalid token payload');
    }

    return { document, name };
  }

  private async bootstrapFor(client: Socket, user: RegisteredChatUser): Promise<ChatBootstrap> {
    const [conversations, unreadCount] = await Promise.all([
      this.isChatLocked(client)
        ? Promise.resolve([])
        : this.store.listFor(user.id, document => this.isOnline(document)),
      this.store.unreadCountFor(user.id),
    ]);

    return {
      conversations,
      notifications: { unreadCount },
      security: this.securityStateFor(client),
      ...(this.canViewOnlineUsersCount(user.document)
        ? { onlineUsersCount: this.connectedUsers.size }
        : {}),
    };
  }

  private async emitBootstrap(client: Socket, user: RegisteredChatUser): Promise<void> {
    client.emit(SOCKET_EVENTS.chat.bootstrap, await this.bootstrapFor(client, user));
  }

  private securityStateFor(client: Socket): ChatSecurityState {
    const enabled = client.data.chatSecurityEnabled !== false;
    return {
      enabled,
      locked: enabled && client.data.chatSecurityUnlocked !== true,
      lockAfterMinutes: CHAT_SECURITY_LOCK_DELAY_MS / 60_000,
    };
  }

  private isChatLocked(client: Socket): boolean {
    return this.securityStateFor(client).locked;
  }

  private touchSecurityActivity(client: Socket): void {
    if (client.data.chatSecurityEnabled !== true || this.isChatLocked(client)) return;

    this.clearSecurityTimeout(client.id);
    this.securityLockTimeouts.set(
      client.id,
      setTimeout(() => this.lockClient(client), CHAT_SECURITY_LOCK_DELAY_MS)
    );
  }

  private lockClient(client: Socket): void {
    if (client.data.chatSecurityEnabled !== true) return;

    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (currentUser) void this.stopClientTyping(client, currentUser);
    this.clearSecurityTimeout(client.id);
    client.data.chatSecurityUnlocked = false;
    client.emit(SOCKET_EVENTS.chat.securityState, this.securityStateFor(client));
  }

  private clearSecurityTimeout(clientId: string): void {
    const timeout = this.securityLockTimeouts.get(clientId);
    if (timeout) clearTimeout(timeout);
    this.securityLockTimeouts.delete(clientId);
  }

  private syncSecurityWithOtherClients(
    source: Socket,
    user: RegisteredChatUser,
    enabled: boolean
  ): void {
    const clients = this.connectedClients.get(normalizeDocument(user.document));
    if (!clients) return;

    for (const client of clients) {
      if (client.id === source.id) continue;

      client.data.chatSecurityEnabled = enabled;
      client.data.chatSecurityUnlocked = !enabled;
      if (enabled) void this.stopClientTyping(client, user);
      this.clearSecurityTimeout(client.id);
      client.emit(SOCKET_EVENTS.chat.securityState, this.securityStateFor(client));
      if (!enabled) void this.emitBootstrap(client, user);
    }
  }

  private async startClientTyping(
    client: Socket,
    currentUser: RegisteredChatUser,
    conversationId: number
  ): Promise<void> {
    const activeConversationId = Number(client.data.chatTypingConversationId);
    if (activeConversationId !== conversationId) {
      await this.stopClientTyping(client, currentUser);
      const participants = await this.store.participants(conversationId);
      if (!participants.some(participant => participant.id === currentUser.id)) return;

      client.data.chatTypingConversationId = conversationId;
      client.data.chatTypingRecipients = participants
        .filter(participant => participant.id !== currentUser.id)
        .map(participant => participant.document);
    }

    const recipients = Array.isArray(client.data.chatTypingRecipients)
      ? (client.data.chatTypingRecipients as string[])
      : [];
    const state: ChatTypingState = {
      conversationId,
      document: normalizeDocument(currentUser.document),
      typing: true,
    };
    await Promise.all(
      recipients.map(document =>
        this.emitToUnlockedUser(document, SOCKET_EVENTS.chat.typing, state)
      )
    );
  }

  private async stopClientTyping(client: Socket, currentUser: RegisteredChatUser): Promise<void> {
    const conversationId = Number(client.data.chatTypingConversationId);
    const recipients = Array.isArray(client.data.chatTypingRecipients)
      ? (client.data.chatTypingRecipients as string[])
      : [];
    delete client.data.chatTypingConversationId;
    delete client.data.chatTypingRecipients;
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return;

    const state: ChatTypingState = {
      conversationId,
      document: normalizeDocument(currentUser.document),
      typing: false,
    };
    await Promise.all(
      recipients.map(document =>
        this.emitToUnlockedUser(document, SOCKET_EVENTS.chat.typing, state)
      )
    );
  }

  private registerClient(document: string, client: Socket): void {
    const normalized = normalizeDocument(document);
    const clients = this.connectedClients.get(normalized) ?? new Set<Socket>();
    clients.add(client);
    this.connectedClients.set(normalized, clients);
  }

  private unregisterClient(document: string, client: Socket): void {
    const normalized = normalizeDocument(document);
    const clients = this.connectedClients.get(normalized);
    if (!clients) return;

    clients.delete(client);
    if (!clients.size) this.connectedClients.delete(normalized);
  }

  private async emitToUnlockedUser(
    document: string,
    event: string,
    payload: unknown
  ): Promise<void> {
    const clients = this.connectedClients.get(normalizeDocument(document));
    if (!clients) return;

    for (const client of clients) {
      if (!this.isChatLocked(client)) client.emit(event, payload);
    }
  }

  private async emitNotificationState(user: RegisteredChatUser): Promise<void> {
    const payload: ChatNotificationState = {
      unreadCount: await this.store.unreadCountFor(user.id),
    };
    const clients = this.connectedClients.get(normalizeDocument(user.document));
    if (!clients) return;

    for (const client of clients) client.emit(SOCKET_EVENTS.chat.notificationState, payload);
  }

  private async emitConversationUpdate(conversationId: number): Promise<void> {
    try {
      const participants = await this.store.participants(conversationId);
      await Promise.all(
        participants.map(async participant => {
          const conversations = await this.store.listFor(participant.id, document =>
            this.isOnline(document)
          );
          const summary = conversations.find(conversation => conversation.id === conversationId);
          await Promise.all([
            summary ? this.emitSummaryToUser(participant.document, summary) : Promise.resolve(),
            this.emitNotificationState(participant),
          ]);
        })
      );
    } catch {
      // El mensaje ya quedó persistido; la bandeja se recuperará al reconectar.
    }
  }

  private async emitMessageMutation(message: ChatMessage): Promise<void> {
    try {
      const participants = await this.store.participants(message.conversationId);
      await Promise.all([
        this.emitConversationUpdate(message.conversationId),
        ...participants.map(participant =>
          this.emitToUnlockedUser(participant.document, SOCKET_EVENTS.chat.messageUpdated, message)
        ),
      ]);
    } catch {
      // El cambio ya quedó persistido; el estado se recuperará al reconectar.
    }
  }

  private emitSummaryToUser(document: string, summary: ChatConversationSummary): Promise<void> {
    return this.emitToUnlockedUser(document, SOCKET_EVENTS.chat.conversationUpdated, summary);
  }

  private async emitPresence(user: RegisteredChatUser): Promise<void> {
    const presence: ChatPresence = {
      document: normalizeDocument(user.document),
      online: this.isOnline(user.document),
    };
    let recipients: string[] = [];

    try {
      recipients = (await this.store.peersFor(user.id)).map(peer => peer.document);
      if ((await this.directory.findByIds([user.id])).length === 1) {
        recipients = [...this.connectedUsers.keys()];
      }
    } catch {
      // La presencia se recuperará en la próxima conexión satisfactoria.
    }

    for (const recipient of new Set(recipients)) {
      if (recipient !== presence.document) {
        await this.emitToUnlockedUser(recipient, SOCKET_EVENTS.chat.presence, presence);
      }
    }
  }

  private isOnline(document: string): boolean {
    return (this.connectedUsers.get(normalizeDocument(document)) ?? 0) > 0;
  }

  private canTalkWithAltosMandos(document: string): boolean {
    return CAN_TALK_WITH_ALTOS_MANDOS_DOCUMENTS.has(normalizeDocument(document));
  }

  private emitOnlineUsersCount(): void {
    const payload: ChatOnlineUsersCount = { count: this.connectedUsers.size };

    for (const document of ONLINE_USERS_COUNT_ALLOWED_DOCUMENTS) {
      if (this.isOnline(document)) {
        this.server.to(this.userRoom(document)).emit(SOCKET_EVENTS.chat.onlineUsersCount, payload);
      }
    }
  }

  private canViewOnlineUsersCount(document: string): boolean {
    return ONLINE_USERS_COUNT_ALLOWED_DOCUMENTS.has(normalizeDocument(document));
  }

  private changeConnectionCount(document: string, difference: number): void {
    const normalized = normalizeDocument(document);
    const next = Math.max(0, (this.connectedUsers.get(normalized) ?? 0) + difference);
    if (next === 0) this.connectedUsers.delete(normalized);
    else this.connectedUsers.set(normalized, next);
  }

  private userRoom(document: string): string {
    const digest = createHash('sha256').update(normalizeDocument(document)).digest('hex');
    return `user:${digest}`;
  }

  private unauthorized<T>(): ChatActionAck<T> {
    return { ok: false, error: 'No fue posible identificar tu sesión.' };
  }

  private chatLocked<T>(cleanupAttachments = false): ChatActionAck<T> {
    return {
      ok: false,
      error: 'El chat está bloqueado. Ingresa tu PIN para continuar.',
      requiresPin: true,
      ...(cleanupAttachments ? { cleanupAttachments: true } : {}),
    };
  }

  private rejectedMessage(error: string): ChatActionAck<ChatMessage> {
    return { ok: false, error, cleanupAttachments: true };
  }

  private rejectedMutation(error: string): ChatActionAck<ChatMessage> {
    return { ok: false, error };
  }

  private messageMutationError(error: ChatMessageMutationError): string {
    switch (error) {
      case 'expired':
        return 'Solo puedes editar o eliminar un mensaje durante los 10 minutos posteriores a su envío.';
      case 'deleted':
        return 'El mensaje ya fue eliminado.';
      case 'empty':
        return 'El mensaje debe conservar texto o al menos un archivo adjunto.';
      default:
        return 'No puedes modificar este mensaje.';
    }
  }

  private logPersistenceError(action: string, error: unknown): void {
    const trace = error instanceof Error ? error.stack : String(error);
    this.logger.error(`Error al ${action} del chat`, trace);
  }
}
