import { Injectable } from '@nestjs/common';
import { ChatSecuritySharedSource } from './shared-source';

@Injectable()
export class ChatSecurityIsValidPinImpl extends ChatSecuritySharedSource {
  execute(pin: unknown): pin is string {
    return this.isValidPinValue(pin);
  }
}
