import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { normalizeSocketDocument } from './types';

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

  emitToUser(document: string, event: string, payload: unknown): void {
    for (const client of this.clientsFor(document)) client.emit(event, payload);
  }

  roomFor(document: string): string {
    const digest = createHash('sha256').update(normalizeSocketDocument(document)).digest('hex');
    return `user:${digest}`;
  }
}
