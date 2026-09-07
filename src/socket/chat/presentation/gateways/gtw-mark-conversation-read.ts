import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatConversationSummary,
  OpenConversationPayload,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class MarkConversationReadImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: OpenConversationPayload
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
}
