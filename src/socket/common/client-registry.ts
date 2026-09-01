import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { normalizeSocketDocument, type SocketUser } from './types';

@Injectable()
export class SocketClientRegistry {
  private readonly clientsByDocument = new Map<string, Set<Socket>>();
  private readonly documentByClientId = new Map<string, string>();

  register(document: string, client: Socket): void {
    const normalizedDocument = normalizeSocketDocument(document);
    if (!normalizedDocument) return;

    const registeredDocument = this.documentByClientId.get(client.id);
    if (registeredDocument === normalizedDocument) return;
    if (registeredDocument) this.unregister(client);

    const clients = this.clientsByDocument.get(normalizedDocument) ?? new Set<Socket>();
    clients.add(client);
    this.clientsByDocument.set(normalizedDocument, clients);
    this.documentByClientId.set(client.id, normalizedDocument);
    void client.join(this.roomFor(normalizedDocument));
  }

  unregister(client: Socket): void {
    const document = this.documentByClientId.get(client.id);
    if (!document) return;

    const clients = this.clientsByDocument.get(document);
    clients?.delete(client);
    if (!clients?.size) this.clientsByDocument.delete(document);
    this.documentByClientId.delete(client.id);
  }

  clientsFor(document: string): readonly Socket[] {
    return [...(this.clientsByDocument.get(normalizeSocketDocument(document)) ?? [])];
  }

  isOnline(document: string): boolean {
    return this.clientsFor(document).length > 0;
  }

  onlineDocuments(): readonly string[] {
    return [...this.clientsByDocument.keys()];
  }

  onlineUsersCount(): number {
    return this.clientsByDocument.size;
  }

  emitToAuthenticatedClientApp(clientApp: string, event: string, payload: unknown): number {
    const notifiedDocuments = new Set<string>();

    for (const clients of this.clientsByDocument.values()) {
      for (const client of clients) {
        const user = client.data.socketUser as SocketUser | undefined;
        if (user?.clientApp !== clientApp) continue;
        client.emit(event, payload);
        notifiedDocuments.add(user.document);
      }
    }

    return notifiedDocuments.size;
  }

  emitToMatchingAuthenticatedUsers(
    clientApp: string,
    event: string,
    payloadForUser: (user: SocketUser) => unknown | undefined
  ): number {
    const notifiedUsers = new Set<string>();

    for (const clients of this.clientsByDocument.values()) {
      for (const client of clients) {
        const user = client.data.socketUser as SocketUser | undefined;
        if (!user || user.clientApp !== clientApp) continue;

        const payload = payloadForUser(user);
        if (payload === undefined) continue;

        client.emit(event, payload);
        notifiedUsers.add(`${user.role}:${user.centerId}:${user.userId}`);
      }
    }

    return notifiedUsers.size;
  }

  emitToUser(document: string, event: string, payload: unknown): void {
    for (const client of this.clientsFor(document)) client.emit(event, payload);
  }

  roomFor(document: string): string {
    const digest = createHash('sha256').update(normalizeSocketDocument(document)).digest('hex');
    return `user:${digest}`;
  }
}
