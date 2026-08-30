import { Injectable } from '@nestjs/common';
import { CRYPTO_SERVICES } from '@common/application/services';
import { IsNull, Not } from 'typeorm';
import { GCM_CONTEXTS } from '@common/domain/types';
import { switchConn } from '@common/infrastructure/services';
import { ChatSecurityOrm } from '../orm/security.orm';

interface FailedPinState {
  attempts: number;
  blockedUntil: number;
}

export interface ChatPinVerification {
  valid: boolean;
  retryAfterSeconds?: number;
}

@Injectable()
export class ChatSecurityService {
  private static readonly PIN_PATTERN = /^\d{4}$/;
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly BLOCK_DURATION_MS = 30_000;

  private readonly sharedConn = switchConn(GCM_CONTEXTS.EKLIPSE);
  private readonly failedAttempts = new Map<number, FailedPinState>();

  isValidPin(pin: unknown): pin is string {
    return typeof pin === 'string' && ChatSecurityService.PIN_PATTERN.test(pin);
  }

  isEnabled(userId: number): Promise<boolean> {
    return this.sharedConn.getRepository(ChatSecurityOrm).exists({
      where: { userId, pinHash: Not(IsNull()) },
    });
  }

  async enable(userId: number, pin: string): Promise<void> {
    if (!this.isValidPin(pin)) throw new Error('Invalid PIN');

    const pinHash = await CRYPTO_SERVICES.encrypt(pin);
    await this.sharedConn.transaction('SERIALIZABLE', async manager => {
      const repository = manager.getRepository(ChatSecurityOrm);
      const existing = await repository.findOne({ where: { userId } });
      const now = new Date();
      await repository.save(
        repository.create({
          ...existing,
          userId,
          pinHash,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        })
      );
    });
    this.failedAttempts.delete(userId);
  }

  async verify(userId: number, pin: string): Promise<ChatPinVerification> {
    if (!this.isValidPin(pin)) return { valid: false };

    const failedState = this.failedAttempts.get(userId);
    const now = Date.now();
    if (failedState?.blockedUntil && failedState.blockedUntil > now) {
      return {
        valid: false,
        retryAfterSeconds: Math.ceil((failedState.blockedUntil - now) / 1000),
      };
    }

    const security = await this.sharedConn
      .getRepository(ChatSecurityOrm)
      .createQueryBuilder('security')
      .addSelect('security.pinHash')
      .where('security.CHATUSUREG = :userId', { userId })
      .getOne();
    if (!security?.pinHash) return { valid: false };

    const valid = await CRYPTO_SERVICES.compare(pin, security.pinHash);
    if (valid) {
      this.failedAttempts.delete(userId);
      return { valid: true };
    }

    const attempts = (failedState?.attempts ?? 0) + 1;
    if (attempts >= ChatSecurityService.MAX_FAILED_ATTEMPTS) {
      this.failedAttempts.set(userId, {
        attempts: 0,
        blockedUntil: now + ChatSecurityService.BLOCK_DURATION_MS,
      });
      return {
        valid: false,
        retryAfterSeconds: ChatSecurityService.BLOCK_DURATION_MS / 1000,
      };
    }

    this.failedAttempts.set(userId, { attempts, blockedUntil: 0 });
    return { valid: false };
  }

  async disable(userId: number, pin: string): Promise<ChatPinVerification> {
    const verification = await this.verify(userId, pin);
    if (!verification.valid) return verification;

    await this.sharedConn.getRepository(ChatSecurityOrm).update(
      { userId },
      {
        pinHash: null,
        updatedAt: new Date(),
      }
    );
    this.failedAttempts.delete(userId);
    return { valid: true };
  }
}
