import { Module } from '@nestjs/common';
import { EventsManagerModule } from './events/module';
import { ChatManagerModule } from './chat/module';

@Module({
  imports: [ChatManagerModule, EventsManagerModule],
})
export class ManagerModule {}
