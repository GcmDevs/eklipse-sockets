import { Injectable } from '@nestjs/common';
import { ChatSecurityOrm } from '@socket/chat/infrastructure/orm';
import { ChatSecuritySharedSource } from './shared-source';
import { ChatSecurityVerifyImpl } from './svc-verify';
import type { ChatPinVerification } from '@socket/chat/domain/types';

@Injectable()
export class ChatSecurityDisableImpl extends ChatSecuritySharedSource {
  constructor(private readonly _verify: ChatSecurityVerifyImpl) {
    super();
  }

  async execute(userId: number, pin: string): Promise<ChatPinVerification> {
    const verification = await this._verify.execute(userId, pin);
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
