import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatConversationHidden,
  HideChatConversationPayload,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SOCKET_EVENTS } from '@socket/common/events';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class HideConversationImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: HideChatConversationPayload
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
}
