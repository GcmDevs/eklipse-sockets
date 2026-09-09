import { Module } from '@nestjs/common';
import { AddNewUsersFromDimController } from './presentation/controllers';

@Module({
  controllers: [AddNewUsersFromDimController],
})
export class ChatManagerModule {}
