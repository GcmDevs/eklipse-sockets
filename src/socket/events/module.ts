import { Module } from '@nestjs/common';
import { SocketCommonModule } from '@socket/common/module';
import { EventStoreService } from './infrastructure/services';
import {
  CreateEventImpl,
  EventsGateway,
  ListCreatedEventsImpl,
  ListEventInvitationsImpl,
  RespondEventInvitationImpl,
  UpdateEventImpl,
} from './presentation';

@Module({
  imports: [SocketCommonModule],
  providers: [
    EventStoreService,
    CreateEventImpl,
    ListCreatedEventsImpl,
    UpdateEventImpl,
    ListEventInvitationsImpl,
    RespondEventInvitationImpl,
    EventsGateway,
  ],
})
export class EventsModule {}
