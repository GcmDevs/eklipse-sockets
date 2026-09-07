import { Module } from '@nestjs/common';
import { ChatModule } from './chat/module';
import { SocketCommonModule } from './common/module';
import { EventsModule } from './events/module';

@Module({
  imports: [SocketCommonModule, ChatModule, EventsModule],
})
export class SocketModule {}
