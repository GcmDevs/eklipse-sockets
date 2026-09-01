import { Injectable } from '@nestjs/common';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatConversationOrm } from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatPeersForImpl extends ChatStoreSharedSource {
  async execute(userId: number): Promise<RegisteredChatUser[]> {
    const conversations = await this.sharedConn.getRepository(ChatConversationOrm).find({
      where: [{ firstUserId: userId }, { secondUserId: userId }],
      relations: ['firstUser', 'secondUser'],
    });
    const peers = new Map<number, RegisteredChatUser>();

    for (const conversation of conversations) {
      const peer = this.otherParticipant(conversation, userId);
      if (peer) peers.set(peer.id, peer);
    }

    return [...peers.values()];
  }
}
