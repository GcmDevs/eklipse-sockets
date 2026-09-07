import { Module } from '@nestjs/common';
import { AddNewUsersFromDimController } from './add-new-users-from-dim.controller';

@Module({
  controllers: [AddNewUsersFromDimController],
})
export class SocketsControllers {}
