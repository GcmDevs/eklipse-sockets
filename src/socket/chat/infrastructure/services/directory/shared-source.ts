import { Injectable } from '@nestjs/common';
import { ChatAccessService } from '../access';
import { switchSocketsConn } from '@common/infrastructure/services';
import type { RegisteredChatUser } from '@socket/chat/domain/types';
import { normalizeDocument } from '@socket/chat/domain/types';
import { SocketUserOrm } from '@socket/common/infrastructure/orm';

@Injectable()
export class ChatDirectorySharedSource {
  constructor(protected readonly access: ChatAccessService) {}
  protected readonly MAX_SEARCH_RESULTS = 20;
  protected readonly sharedConn = switchSocketsConn();

  protected toChatUser(record: SocketUserOrm): RegisteredChatUser | undefined {
    const id = Number(record.id);
    const document = normalizeDocument(String(record.document ?? ''));
    const name = String(record.fullName ?? '').trim();
    return Number.isInteger(id) && id > 0 && document && name ? { id, document, name } : undefined;
  }
}
