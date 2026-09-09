import { Module } from '@nestjs/common';
import { PatientAccessController } from './presentation/controllers';
import { PatientAccessService } from './infrastructure/services';

@Module({
  controllers: [PatientAccessController],
  providers: [PatientAccessService],
})
export class EventsManagerModule {}
