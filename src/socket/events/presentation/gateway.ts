import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { SOCKET_GATEWAY_OPTIONS } from '@socket/common/constants';
import { SOCKET_EVENTS } from '@socket/common/events';
import type {
  CreatedEventData,
  CreateEventPayload,
  EventActionAck,
  NewEventInvitation,
  RegisteredEventData,
  RespondEventInvitationPayload,
  UpdateEventPayload,
  UpdatedEventData,
} from '@socket/events/domain/types';
import { CreateEventImpl } from './create-event.impl';
import { ListCreatedEventsImpl } from './list-created-events.impl';
import { ListEventInvitationsImpl } from './list-event-invitations.impl';
import { RespondEventInvitationImpl } from './respond-event-invitation.impl';
import { UpdateEventImpl } from './update-event.impl';

@WebSocketGateway(SOCKET_GATEWAY_OPTIONS)
export class EventsGateway {
  constructor(
    private readonly createEventImpl: CreateEventImpl,
    private readonly listCreatedEventsImpl: ListCreatedEventsImpl,
    private readonly updateEventImpl: UpdateEventImpl,
    private readonly listEventInvitationsImpl: ListEventInvitationsImpl,
    private readonly respondEventInvitationImpl: RespondEventInvitationImpl
  ) {}

  @SubscribeMessage(SOCKET_EVENTS.events.create)
  createEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateEventPayload
  ): Promise<EventActionAck<CreatedEventData>> {
    return this.createEventImpl.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.events.listCreated)
  listCreatedEvents(
    @ConnectedSocket() client: Socket
  ): Promise<EventActionAck<RegisteredEventData[]>> {
    return this.listCreatedEventsImpl.execute(client);
  }

  @SubscribeMessage(SOCKET_EVENTS.events.update)
  updateEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UpdateEventPayload
  ): Promise<EventActionAck<UpdatedEventData>> {
    return this.updateEventImpl.execute(client, payload);
  }

  @SubscribeMessage(SOCKET_EVENTS.events.invitationList)
  listInvitations(
    @ConnectedSocket() client: Socket
  ): Promise<EventActionAck<NewEventInvitation[]>> {
    return this.listEventInvitationsImpl.execute(client);
  }

  @SubscribeMessage(SOCKET_EVENTS.events.invitationRespond)
  respondInvitation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RespondEventInvitationPayload
  ): Promise<EventActionAck<NewEventInvitation>> {
    return this.respondEventInvitationImpl.execute(client, payload);
  }
}
