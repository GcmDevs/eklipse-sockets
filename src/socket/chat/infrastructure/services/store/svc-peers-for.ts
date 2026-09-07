import { chatAccessPredicate } from '../access';
import { Injectable } from '@nestjs/common';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatConversationOrm } from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatPeersForImpl extends ChatStoreSharedSource {
  async execute(userId: number): Promise<RegisteredChatUser[]> {
    const query = this.sharedConn
      .getRepository(ChatConversationOrm)
      .createQueryBuilder('conversation');
    query.setFindOptions({
      where: [{ firstUserId: userId }, { secondUserId: userId }],
      relations: ['firstUser', 'secondUser'],
    });
    const conversations = await query
      .andWhere(
        chatAccessPredicate(
          ':accessUserId',
          'CASE WHEN "conversation"."CHATUSUREG1" = :accessUserId THEN "conversation"."CHATUSUREG2" ELSE "conversation"."CHATUSUREG1" END'
        ),
        { accessUserId: userId }
      )
      .getMany();
    const peers = new Map<number, RegisteredChatUser>();

    for (const conversation of conversations) {
      const peer = this.otherParticipant(conversation, userId);
      if (peer) peers.set(peer.id, peer);
    }

    return [...peers.values()];
  }
}
