import { Module } from '@nestjs/common';
import { ChatDirectoryService } from './infrastructure/services/directory.service';
import { ChatGateway } from './gateway';
import { ChatStoreService } from './infrastructure/services/store.service';
import { ChatSecurityService } from './infrastructure/services/security.service';
import { FileSaverModule } from '../../file-saver/module';

@Module({
  imports: [FileSaverModule],
  providers: [ChatDirectoryService, ChatSecurityService, ChatStoreService, ChatGateway],
})
export class ChatModule {}
