import { Injectable } from '@nestjs/common';
import { CRYPTO_SERVICES } from '@common/application/services';
import { ChatSecurityOrm } from '@socket/chat/infrastructure/orm';
import { ChatSecuritySharedSource } from './shared-source';
import type { ChatPinVerification } from '@socket/chat/domain/types';

@Injectable()
export class ChatSecurityVerifyImpl extends ChatSecuritySharedSource {
  async execute(userId: number, pin: string): Promise<ChatPinVerification> {
    if (!this.isValidPinValue(pin)) return { valid: false };

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
    if (attempts >= this.MAX_FAILED_ATTEMPTS) {
      this.failedAttempts.set(userId, {
        attempts: 0,
        blockedUntil: now + this.BLOCK_DURATION_MS,
      });
      return {
        valid: false,
        retryAfterSeconds: this.BLOCK_DURATION_MS / 1000,
      };
    }

    this.failedAttempts.set(userId, { attempts, blockedUntil: 0 });
    return { valid: false };
  }
}
