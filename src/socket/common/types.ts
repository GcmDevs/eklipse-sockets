export interface SocketUser {
  id: string;
  context: string;
  document: string;
  name: string;
}

export const normalizeSocketDocument = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';
