import { Module } from '@nestjs/common';
import { PatientAccessController } from './presentation/controllers';
import { PatientAccessService } from './infrastructure/services';
import { ChatModule } from '@socket/chat/module';

@Module({
  imports: [ChatModule],
  controllers: [PatientAccessController],
  providers: [PatientAccessService],
})
export class EventsManagerModule {}
