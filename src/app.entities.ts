import { CHAT_ENTITIES } from './socket/chat/infrastructure/orm';
import { EVENT_ENTITIES } from './socket/events/infrastructure/orm';

export const ENTITIES = [
  // --- AVOID NOWRAP --- //
  ...CHAT_ENTITIES,
  ...EVENT_ENTITIES,
];
