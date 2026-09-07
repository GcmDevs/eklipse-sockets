import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatConversationDetails,
  RegisteredChatUser,
  StartConversationPayload,
} from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class StartConversationImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: StartConversationPayload
  ): Promise<ChatActionAck<ChatConversationDetails>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    await this.stopClientTyping(client, currentUser);
    this.touchSecurityActivity(client);

    let registeredCurrentUser: RegisteredChatUser | undefined;
    let contact: RegisteredChatUser | undefined;
    try {
      [registeredCurrentUser, contact] = await Promise.all([
        this.directory.findByDocument(currentUser.document),
        this.directory.findByDocument(payload?.document),
      ]);
    } catch {
      return {
        ok: false,
        error: 'No fue posible consultar el directorio de usuarios. Intenta nuevamente.',
      };
    }
    if (!registeredCurrentUser || registeredCurrentUser.id !== currentUser.id) {
      return { ok: false, error: 'Tu usuario ya no está registrado para utilizar el chat.' };
    }
    if (!contact) return { ok: false, error: 'No encontramos un usuario con ese documento.' };
    if (contact.id === registeredCurrentUser.id) {
      return { ok: false, error: 'No puedes iniciar una conversación contigo mismo.' };
    }

    try {
      if (!(await this.access.canContact(registeredCurrentUser.id, contact.id))) {
        return { ok: false, error: 'No encontramos un usuario con ese documento.' };
      }
      const details = await this.store.start(registeredCurrentUser, contact, document =>
        this.isOnline(document)
      );
      void this.emitConversationUpdate(details.conversation.id);
      return { ok: true, data: details };
    } catch (error) {
      this.logPersistenceError('crear una conversación', error);
      return { ok: false, error: 'No fue posible guardar la conversación.' };
    }
  }
}
