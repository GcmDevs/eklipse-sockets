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
export class EnableSecurityImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: ChatPinPayload
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
}
