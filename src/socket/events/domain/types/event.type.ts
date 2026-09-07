import type { EventAttendanceStatusCode } from './event-attendance-status.type';

export interface CreateEventPayload {
  title?: unknown;
  description?: unknown;
  location?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  organizerDescription?: unknown;
}

export interface UpdateEventPayload extends CreateEventPayload {
  eventId?: unknown;
}

export interface NewEventData {
  id: number;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  organizerDescription: string;
  createdAt: string;
}

export interface NewEventInvitation extends NewEventData {
  invitationId: number;
  status: EventAttendanceStatusCode;
  invitedAt: string;
  respondedAt: string | null;
}

export interface RespondEventInvitationPayload {
  invitationId?: unknown;
  status?: unknown;
}

export interface CreatedEventData extends NewEventData {
  connectedUsersCount: number;
  invitedUsersCount: number;
}

export interface RegisteredEventData extends NewEventData {
  updatedAt: string;
  invitedUsersCount: number;
  pendingUsersCount: number;
  attendingUsersCount: number;
  notAttendingUsersCount: number;
}

export interface UpdatedEventData extends RegisteredEventData {
  connectedUsersCount: number;
}

export interface PersistedEventCreation {
  event: NewEventData;
  invitations: PersistedEventInvitation[];
  invitedUsersCount: number;
}

export interface PersistedEventInvitation {
  id: number;
  inviteeUserId: number;
  centerId: number;
  status: EventAttendanceStatusCode;
  invitedAt: string;
  respondedAt: string | null;
}

export interface PersistedEventUpdate {
  event: RegisteredEventData;
  invitations: PersistedEventInvitation[];
}

export interface EventActionAck<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ValidatedCreateEvent {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  organizerDescription: string;
}
