import { GCM_CONTEXTS } from '@common/domain/types';
import { switchConn } from '@common/infrastructure/services';

interface FailedPinState {
  attempts: number;
  blockedUntil: number;
}

const FAILED_ATTEMPTS = new Map<number, FailedPinState>();

export class ChatSecuritySharedSource {
  protected readonly PIN_PATTERN = /^\d{4}$/;
  protected readonly MAX_FAILED_ATTEMPTS = 5;
  protected readonly BLOCK_DURATION_MS = 30_000;
  protected readonly sharedConn = switchConn(GCM_CONTEXTS.EKLIPSE);
  protected readonly failedAttempts = FAILED_ATTEMPTS;

  protected isValidPinValue(pin: unknown): pin is string {
    return typeof pin === 'string' && this.PIN_PATTERN.test(pin);
  }
}
