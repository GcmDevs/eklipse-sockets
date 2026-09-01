import { VALID_HOSTS } from '../../app.environments';

export const SOCKET_NAMESPACE = '/socket';

export const SOCKET_GATEWAY_OPTIONS = {
  namespace: SOCKET_NAMESPACE,
  cors: { origin: VALID_HOSTS },
};
