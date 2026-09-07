import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatConversationDetails,
  OpenConversationPayload,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class OpenConversationImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: OpenConversationPayload
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
}
