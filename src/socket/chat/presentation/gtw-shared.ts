import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatBootstrap,
  ChatConversationSummary,
  ChatMessage,
  ChatNotificationState,
  ChatOnlineUsersCount,
  ChatPresence,
  ChatSecurityState,
  ChatTypingState,
  RegisteredChatUser,
  ChatMessageMutationError,
} from '@socket/chat/domain/types';
import { SOCKET_EVENTS } from '@common/application/events';
import {
  ChatStoreService,
  ChatDirectoryService,
  ChatSecurityService,
} from '@socket/chat/infrastructure/services';
import { normalizeDocument } from '@socket/chat/domain/types';
import { FileServerRegistry } from '@file-saver/registry';
import { ADMINS, CAN_TALK_WITH_ALTOS_MANDOS } from '@common/application/constants';
import { SocketClientRegistry } from '@socket/common/client-registry';

const ONLINE_USERS_COUNT_ALLOWED_DOCUMENTS = new Set(ADMINS);
const CAN_TALK_WITH_ALTOS_MANDOS_DOCUMENTS = new Set(
  CAN_TALK_WITH_ALTOS_MANDOS.map(normalizeDocument)
);
const CHAT_SECURITY_LOCK_DELAY_MS = 10 * 60 * 1000;
const SECURITY_LOCK_TIMEOUTS = new Map<string, NodeJS.Timeout>();

@Injectable()
export class SharedChatGateway {
  protected readonly MAX_MESSAGE_LENGTH = 10000;
  protected readonly logger = new Logger(SharedChatGateway.name);

  protected readonly securityLockTimeouts = SECURITY_LOCK_TIMEOUTS;

  constructor(
    protected readonly directory: ChatDirectoryService,
    protected readonly security: ChatSecurityService,
    protected readonly store: ChatStoreService,
    protected readonly fileRegistry: FileServerRegistry,
    protected readonly clients: SocketClientRegistry
  ) {}

  protected async bootstrapFor(client: Socket, user: RegisteredChatUser): Promise<ChatBootstrap> {
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
        ? { onlineUsersCount: this.onlineChatDocuments().length }
        : {}),
    };
  }

  protected async emitBootstrap(client: Socket, user: RegisteredChatUser): Promise<void> {
    client.emit(SOCKET_EVENTS.chat.bootstrap, await this.bootstrapFor(client, user));
  }

  protected securityStateFor(client: Socket): ChatSecurityState {
    const enabled = client.data.chatSecurityEnabled !== false;
    return {
      enabled,
      locked: enabled && client.data.chatSecurityUnlocked !== true,
      lockAfterMinutes: CHAT_SECURITY_LOCK_DELAY_MS / 60_000,
    };
  }

  protected isChatLocked(client: Socket): boolean {
    return this.securityStateFor(client).locked;
  }

  protected touchSecurityActivity(client: Socket): void {
    if (client.data.chatSecurityEnabled !== true || this.isChatLocked(client)) return;

    this.clearSecurityTimeout(client.id);
    this.securityLockTimeouts.set(
      client.id,
      setTimeout(() => this.lockClient(client), CHAT_SECURITY_LOCK_DELAY_MS)
    );
  }

  protected lockClient(client: Socket): void {
    if (client.data.chatSecurityEnabled !== true) return;

    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (currentUser) void this.stopClientTyping(client, currentUser);
    this.clearSecurityTimeout(client.id);
    client.data.chatSecurityUnlocked = false;
    client.emit(SOCKET_EVENTS.chat.securityState, this.securityStateFor(client));
  }

  protected clearSecurityTimeout(clientId: string): void {
    const timeout = this.securityLockTimeouts.get(clientId);
    if (timeout) clearTimeout(timeout);
    this.securityLockTimeouts.delete(clientId);
  }

  protected syncSecurityWithOtherClients(
    source: Socket,
    user: RegisteredChatUser,
    enabled: boolean
  ): void {
    for (const client of this.chatClientsFor(user.document)) {
      if (client.id === source.id) continue;

      client.data.chatSecurityEnabled = enabled;
      client.data.chatSecurityUnlocked = !enabled;
      if (enabled) void this.stopClientTyping(client, user);
      this.clearSecurityTimeout(client.id);
      client.emit(SOCKET_EVENTS.chat.securityState, this.securityStateFor(client));
      if (!enabled) void this.emitBootstrap(client, user);
    }
  }

  protected async startClientTyping(
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

  protected async stopClientTyping(client: Socket, currentUser: RegisteredChatUser): Promise<void> {
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

  protected async emitToUnlockedUser(
    document: string,
    event: string,
    payload: unknown
  ): Promise<void> {
    for (const client of this.chatClientsFor(document)) {
      if (!this.isChatLocked(client)) client.emit(event, payload);
    }
  }

  protected async emitNotificationState(user: RegisteredChatUser): Promise<void> {
    const payload: ChatNotificationState = {
      unreadCount: await this.store.unreadCountFor(user.id),
    };
    for (const client of this.chatClientsFor(user.document)) {
      client.emit(SOCKET_EVENTS.chat.notificationState, payload);
    }
  }

  protected async emitConversationUpdate(conversationId: number): Promise<void> {
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

  protected async emitMessageMutation(message: ChatMessage): Promise<void> {
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

  protected emitSummaryToUser(document: string, summary: ChatConversationSummary): Promise<void> {
    return this.emitToUnlockedUser(document, SOCKET_EVENTS.chat.conversationUpdated, summary);
  }

  protected async emitPresence(user: RegisteredChatUser): Promise<void> {
    const presence: ChatPresence = {
      document: normalizeDocument(user.document),
      online: this.isOnline(user.document),
    };
    let recipients: string[] = [];

    try {
      recipients = (await this.store.peersFor(user.id)).map(peer => peer.document);
      if ((await this.directory.findByIds([user.id])).length === 1) {
        recipients = this.onlineChatDocuments();
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

  protected isOnline(document: string): boolean {
    return this.chatClientsFor(document).length > 0;
  }

  protected chatClientsFor(document: string): readonly Socket[] {
    return this.clients
      .clientsFor(document)
      .filter(client => Boolean(client.data.chatUser as RegisteredChatUser | undefined));
  }

  protected onlineChatDocuments(): string[] {
    return this.clients.onlineDocuments().filter(document => this.isOnline(document));
  }

  protected canTalkWithAltosMandos(document: string): boolean {
    return CAN_TALK_WITH_ALTOS_MANDOS_DOCUMENTS.has(normalizeDocument(document));
  }

  protected emitOnlineUsersCount(): void {
    const payload: ChatOnlineUsersCount = { count: this.onlineChatDocuments().length };

    for (const document of ONLINE_USERS_COUNT_ALLOWED_DOCUMENTS) {
      if (this.isOnline(document)) {
        this.clients.emitToUser(document, SOCKET_EVENTS.chat.onlineUsersCount, payload);
      }
    }
  }

  protected canViewOnlineUsersCount(document: string): boolean {
    return ONLINE_USERS_COUNT_ALLOWED_DOCUMENTS.has(normalizeDocument(document));
  }

  protected unauthorized<T>(): ChatActionAck<T> {
    return { ok: false, error: 'No fue posible identificar tu sesión.' };
  }

  protected chatLocked<T>(cleanupAttachments = false): ChatActionAck<T> {
    return {
      ok: false,
      error: 'El chat está bloqueado. Ingresa tu PIN para continuar.',
      requiresPin: true,
      ...(cleanupAttachments ? { cleanupAttachments: true } : {}),
    };
  }

  protected rejectedMessage(error: string): ChatActionAck<ChatMessage> {
    return { ok: false, error, cleanupAttachments: true };
  }

  protected rejectedMutation(error: string): ChatActionAck<ChatMessage> {
    return { ok: false, error };
  }

  protected messageMutationError(error: ChatMessageMutationError): string {
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

  protected logPersistenceError(action: string, error: unknown): void {
    const trace = error instanceof Error ? error.stack : String(error);
    this.logger.error(`Error al ${action} del chat`, trace);
  }
}
