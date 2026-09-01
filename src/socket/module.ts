import { Module } from '@nestjs/common';
import { ChatModule } from './chat/module';
import { SocketCommonModule } from './common/module';

@Module({
  imports: [SocketCommonModule, ChatModule],
})
export class SocketModule {}
