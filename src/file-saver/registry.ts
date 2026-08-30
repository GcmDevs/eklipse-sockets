import { Injectable } from '@nestjs/common';
import { normalizeStoredFilePath } from './locations';

interface PendingFile {
  ownerDocument: string;
  reserved: boolean;
}

@Injectable()
export class FileServerRegistry {
  private readonly pendingFiles = new Map<string, PendingFile>();

  register(paths: readonly string[], ownerDocument: string): void {
    const owner = this.normalizeDocument(ownerDocument);
    for (const path of paths) {
      this.pendingFiles.set(normalizeStoredFilePath(path), {
        ownerDocument: owner,
        reserved: false,
      });
    }
  }

  reserve(paths: readonly string[], ownerDocument: string): boolean {
    const normalizedPaths = paths.map(path => normalizeStoredFilePath(path));
    const owner = this.normalizeDocument(ownerDocument);
    const canReserve = normalizedPaths.every(path => {
      const pending = this.pendingFiles.get(path);
      return pending?.ownerDocument === owner && !pending.reserved;
    });
    if (!canReserve) return false;

    for (const path of normalizedPaths) this.pendingFiles.get(path)!.reserved = true;
    return true;
  }

  release(paths: readonly string[], ownerDocument: string): void {
    const owner = this.normalizeDocument(ownerDocument);
    for (const value of paths) {
      const pending = this.pendingFiles.get(normalizeStoredFilePath(value));
      if (pending?.ownerDocument === owner) pending.reserved = false;
    }
  }

  canDelete(paths: readonly string[], ownerDocument: string): boolean {
    const owner = this.normalizeDocument(ownerDocument);
    return paths.every(value => value.includes(owner));
  }

  complete(paths: readonly string[], ownerDocument: string): void {
    const owner = this.normalizeDocument(ownerDocument);
    for (const value of paths) {
      const path = normalizeStoredFilePath(value);
      if (this.pendingFiles.get(path)?.ownerDocument === owner) this.pendingFiles.delete(path);
    }
  }

  private normalizeDocument(value: string): string {
    return String(value ?? '')
      .trim()
      .toUpperCase();
  }
}
