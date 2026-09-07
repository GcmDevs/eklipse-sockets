import { SocketUserOrm } from './user.orm';
import { CenterOrm } from './center.orm';

export * from './center.orm';
export * from './user.orm';

export const SOCKET_ENTITIES = [
  // AVOID NOWRAP
  CenterOrm,
  SocketUserOrm,
];
