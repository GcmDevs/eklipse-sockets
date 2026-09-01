import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatMessagePage,
  LoadPreviousChatMessagesPayload,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class LoadPreviousMessagesImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: LoadPreviousChatMessagesPayload
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
}
