import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatSecurityState,
  RegisteredChatUser,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class LockSecurityImpl extends SharedChatGateway {
  execute(client: Socket): ChatActionAck<ChatSecurityState> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();

    this.lockClient(client);
    return { ok: true, data: this.securityStateFor(client) };
  }
}
