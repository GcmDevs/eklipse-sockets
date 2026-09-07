import { SOCKET_ENTITIES as GEN_SOCKET_ENTITIES } from '@socket/common/infrastructure/orm';
import { CHAT_ENTITIES } from '@socket/chat/infrastructure/orm';

export const ENTITIES = [
  // --- AVOID NOWRAP --- //
];

export const SOCKET_ENTITIES = [
  // --- AVOID NOWRAP ---
  ...GEN_SOCKET_ENTITIES,
  ...CHAT_ENTITIES,
];
