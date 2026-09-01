import type { Socket } from 'socket.io';
import type { ChatBootstrap, RegisteredChatUser } from '@socket/chat/domain/types';
import { SOCKET_EVENTS } from '@socket/common/events';
import type { SocketUser } from '@socket/common/types';
import { SharedChatGateway } from './gtw-shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class handleConnectionImpl extends SharedChatGateway {
  async execute(client: Socket): Promise<void> {
    const socketUser = client.data.socketUser as SocketUser | undefined;
    if (!socketUser) return;

    this.clients.register(socketUser.document, client);
    client.data.chatSecurityEnabled = true;
    client.data.chatSecurityUnlocked = false;

    let user: RegisteredChatUser | undefined;
    try {
      user = await this.directory.findByDocument(socketUser.document);
    } catch {
      client.emit('exception', {
        message: 'No fue posible validar tu acceso al chat. Intenta nuevamente.',
      });
      return;
    }

    if (!user) {
      client.emit('exception', {
        message: 'Tu usuario no está registrado para utilizar el chat.',
      });
      return;
    }
    client.data.chatUser = user;
    this.emitOnlineUsersCount();

    try {
      const securityEnabled = await this.security.isEnabled(user.id);
      client.data.chatSecurityEnabled = securityEnabled;
      client.data.chatSecurityUnlocked = !securityEnabled;
      await this.emitBootstrap(client, user);
    } catch (error) {
      client.data.chatSecurityEnabled = true;
      client.data.chatSecurityUnlocked = false;
      this.logPersistenceError('cargar la seguridad y las conversaciones', error);
      client.emit('exception', {
        message: 'No fue posible validar la seguridad del chat.',
      });
      client.emit(SOCKET_EVENTS.chat.bootstrap, {
        conversations: [],
        notifications: { unreadCount: 0 },
        security: this.securityStateFor(client),
      } satisfies ChatBootstrap);
    }
    void this.emitPresence(user);
  }
}
