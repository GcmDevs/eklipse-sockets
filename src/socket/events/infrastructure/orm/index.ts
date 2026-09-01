import { EventInvitationOrm } from './event-invitation.orm';
import { EventOrm } from './event.orm';

export * from './event-invitation.orm';
export * from './event.orm';

export const EVENT_ENTITIES = [EventOrm, EventInvitationOrm];
