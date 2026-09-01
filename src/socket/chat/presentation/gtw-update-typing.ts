import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { ChatTypingPayload, RegisteredChatUser } from '@socket/chat/domain/types';
import { SharedChatGateway } from './gtw-shared';

@Injectable()
export class UpdateTypingImpl extends SharedChatGateway {
  async execute(client: Socket, payload: ChatTypingPayload): Promise<void> {
    const currentUser = client.data.chatUser as RegisteredChatUser | undefined;
    if (!currentUser) return;
    if (this.isChatLocked(client)) {
      await this.stopClientTyping(client, currentUser);
      return;
    }

    const conversationId = Number(payload?.conversationId);
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return;

    try {
      if (payload?.typing === true) {
        await this.startClientTyping(client, currentUser, conversationId);
        this.touchSecurityActivity(client);
        return;
      }

      if (payload?.typing === false) await this.stopClientTyping(client, currentUser);
    } catch {
      await this.stopClientTyping(client, currentUser);
    }
  }
}
