export interface SocketUser {
  id: string;
  userId: number;
  centerId: number;
  context: string;
  document: string;
  name: string;
  role: SocketUserRole;
  clientApp: string;
}

export type SocketUserRole = 'USUARIO' | 'PACIENTE';

export const normalizeSocketDocument = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';
