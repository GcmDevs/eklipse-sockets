import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { SocketUserOrm } from '@socket/common/orm';
import { ChatDirectorySharedSource } from './shared-source';

@Injectable()
export class ChatDirectoryFindByIdsImpl extends ChatDirectorySharedSource {
  async execute(ids: number[]): Promise<RegisteredChatUser[]> {
    const uniqueIds = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
    if (!uniqueIds.length) return [];

    const records = await this.sharedConn.getRepository(SocketUserOrm).find({
      where: { id: In(uniqueIds) },
    });
    return records.map(record => this.toChatUser(record)).filter(user => user !== undefined);
  }
}
