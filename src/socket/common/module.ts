import { Module } from '@nestjs/common';
import { SocketGateway } from '@socket/gateway';
import { SocketClientRegistry } from './client-registry';

@Module({
  providers: [SocketGateway, SocketClientRegistry],
  exports: [SocketClientRegistry],
})
export class SocketCommonModule {}
