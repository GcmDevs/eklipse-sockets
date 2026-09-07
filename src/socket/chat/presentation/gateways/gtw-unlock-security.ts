import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatPinPayload,
  ChatSecurityUnlockDetails,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class UnlockSecurityImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: ChatPinPayload
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
}
