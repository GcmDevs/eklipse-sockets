import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class HandleDisconnectImpl extends SharedChatGateway {
  execute(client: Socket): void {
    const user = client.data.chatUser as RegisteredChatUser | undefined;
    if (!user) return;

    void this.stopClientTyping(client, user);
    this.clients.unregister(client);
    this.clearSecurityTimeout(client.id);
    this.emitOnlineUsersCount();
    void this.emitPresence(user);
  }
}
