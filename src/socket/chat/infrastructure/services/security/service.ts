import { Injectable } from '@nestjs/common';
import { ChatSecurityDisableImpl } from './svc-disable';
import { ChatSecurityEnableImpl } from './svc-enable';
import { ChatSecurityIsEnabledImpl } from './svc-is-enabled';
import { ChatSecurityIsValidPinImpl } from './svc-is-valid-pin';
import { ChatSecurityVerifyImpl } from './svc-verify';
import type { ChatPinVerification } from '@socket/chat/domain/types';

@Injectable()
export class ChatSecurityService {
  constructor(
    private readonly _isValidPin: ChatSecurityIsValidPinImpl,
    private readonly _isEnabled: ChatSecurityIsEnabledImpl,
    private readonly _enable: ChatSecurityEnableImpl,
    private readonly _verify: ChatSecurityVerifyImpl,
    private readonly _disable: ChatSecurityDisableImpl
  ) {}

  isValidPin(pin: unknown): pin is string {
    return this._isValidPin.execute(pin);
  }

  isEnabled(userId: number): Promise<boolean> {
    return this._isEnabled.execute(userId);
  }

  async enable(userId: number, pin: string): Promise<void> {
    return this._enable.execute(userId, pin);
  }

  async verify(userId: number, pin: string): Promise<ChatPinVerification> {
    return this._verify.execute(userId, pin);
  }

  async disable(userId: number, pin: string): Promise<ChatPinVerification> {
    return this._disable.execute(userId, pin);
  }
}
