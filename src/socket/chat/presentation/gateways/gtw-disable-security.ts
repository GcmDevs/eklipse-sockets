import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatPinPayload,
  ChatSecurityState,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class DisableSecurityImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: ChatPinPayload
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
}
