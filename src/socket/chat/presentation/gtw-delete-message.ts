import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatMessage,
  DeleteChatMessagePayload,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class DeleteMessageImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: DeleteChatMessagePayload
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
}
