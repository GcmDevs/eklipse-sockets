import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatMessage,
  EditChatMessagePayload,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class EditMessageImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: EditChatMessagePayload
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
    if (content.length > this.MAX_MESSAGE_LENGTH) {
      return this.rejectedMutation(
        `El mensaje no puede superar ${this.MAX_MESSAGE_LENGTH} caracteres.`
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
}
