import { Injectable } from '@nestjs/common';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { ChatConversationOrm } from '@socket/chat/infrastructure/orm';
import { ChatStoreSharedSource } from './shared-source';

@Injectable()
export class ChatParticipantsImpl extends ChatStoreSharedSource {
  async execute(conversationId: number): Promise<RegisteredChatUser[]> {
    const conversation = await this.sharedConn.getRepository(ChatConversationOrm).findOne({
      where: { id: conversationId },
      relations: ['firstUser', 'secondUser'],
    });
    return conversation ? this.participantsFrom(conversation) : [];
  }
}
