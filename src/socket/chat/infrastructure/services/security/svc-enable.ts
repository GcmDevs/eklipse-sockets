import { Injectable } from '@nestjs/common';
import { CRYPTO_SERVICES } from '@common/application/services';
import { ChatSecurityOrm } from '@socket/chat/infrastructure/orm';
import { ChatSecuritySharedSource } from './shared-source';

@Injectable()
export class ChatSecurityEnableImpl extends ChatSecuritySharedSource {
  async execute(userId: number, pin: string): Promise<void> {
    if (!this.isValidPinValue(pin)) throw new Error('Invalid PIN');

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
}
