import { Module } from '@nestjs/common';
import { ChatGateway } from '@socket/gateway';
import { FileSaverModule } from '@file-saver/module';
import {
  ChatDirectoryService,
  ChatSecurityService,
  ChatStoreService,
} from './infrastructure/services';

@Module({
  imports: [FileSaverModule],
  providers: [ChatDirectoryService, ChatSecurityService, ChatStoreService, ChatGateway],
})
export class ChatModule {}
