import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type {
  ChatActionAck,
  ChatContact,
  RegisteredChatUser,
  SearchChatUsersPayload,
} from '@socket/chat/domain/types';
import { ALTOS_MANDOS } from '@common/application/constants';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class SearchUsersImpl extends SharedChatGateway {
  async execute(
    client: Socket,
    payload: SearchChatUsersPayload
  ): Promise<ChatActionAck<ChatContact[]>> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return this.unauthorized();
    if (this.isChatLocked(client)) return this.chatLocked();
    this.touchSecurityActivity(client);

    const query = typeof payload?.query === 'string' ? payload.query.trim() : '';
    if (!query) return { ok: true, data: [] };
    if (query.length > 80) {
      return { ok: false, error: 'La búsqueda no puede superar 80 caracteres.' };
    }

    try {
      const excludedDocuments = this.canTalkWithAltosMandos(currentUser.document)
        ? []
        : ALTOS_MANDOS;
      const contacts = (
        await this.directory.search(query, currentUser.document, excludedDocuments)
      ).map(user => ({
        document: user.document,
        name: user.name,
        online: this.isOnline(user.document),
      }));

      return { ok: true, data: contacts };
    } catch {
      return {
        ok: false,
        error: 'No fue posible buscar usuarios. Verifica la conexión e intenta nuevamente.',
      };
    }
  }
}
