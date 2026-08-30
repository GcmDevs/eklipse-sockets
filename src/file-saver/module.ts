import { Module } from '@nestjs/common';
import { FileSaverController } from './controller';
import { FileServerRegistry } from './registry';

@Module({
  controllers: [FileSaverController],
  providers: [FileServerRegistry],
  exports: [FileServerRegistry],
})
export class FileSaverModule {}
