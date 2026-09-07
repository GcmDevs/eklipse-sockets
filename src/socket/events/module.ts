import { Module } from '@nestjs/common';
import { SocketCommonModule } from '@socket/common/module';
import { EventStoreService } from './infrastructure/services';
import {
  CreateEventImpl,
  EventsGateway,
  ListCreatedEventsImpl,
  ListEventAudienceImpl,
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
    ListEventAudienceImpl,
    UpdateEventImpl,
    ListEventInvitationsImpl,
    RespondEventInvitationImpl,
    EventsGateway,
  ],
})
export class EventsModule {}
