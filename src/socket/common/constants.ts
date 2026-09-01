import { VALID_HOSTS } from '../../app.environments';

export const SOCKET_NAMESPACE = '/socket';
export const PATIENTS_FRONTEND_CLIENT = 'pacientes-frontend';

export const SOCKET_GATEWAY_OPTIONS = {
  namespace: SOCKET_NAMESPACE,
  cors: { origin: VALID_HOSTS },
};
