import { Injectable } from '@nestjs/common';
import { IsNull, Not } from 'typeorm';
import { ChatSecurityOrm } from '@socket/chat/infrastructure/orm';
import { ChatSecuritySharedSource } from './shared-source';

@Injectable()
export class ChatSecurityIsEnabledImpl extends ChatSecuritySharedSource {
  execute(userId: number): Promise<boolean> {
    return this.sharedConn.getRepository(ChatSecurityOrm).exists({
      where: { userId, pinHash: Not(IsNull()) },
    });
  }
}
