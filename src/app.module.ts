import { Module, OnModuleInit } from '@nestjs/common';
import { initializeEkSources, initializeSources } from '@common/infrastructure/services';
import { ENTITIES, SOCKET_ENTITIES } from './app.entities';
import {
  FILE_PATHS_ARR,
  FILE_PUBLIC_ROOT,
  FILE_REMOVED_ROOT,
  FILE_TEMP_ROOT,
} from './file-saver/locations';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { FileSaverModule } from './file-saver/module';
import { SocketsControllers } from '@socket/controllers';
import { SocketModule } from '@socket/module';

@Module({
  imports: [
    // --- AVOID NOWRAP --- //
    FileSaverModule,
    SocketsControllers,
    SocketModule,
  ],
})
export class AppModule implements OnModuleInit {
  public async onModuleInit(): Promise<void> {
    initializeSources(ENTITIES);

    initializeEkSources(SOCKET_ENTITIES);

    await Promise.all([
      fs.mkdir(FILE_TEMP_ROOT, { recursive: true }),
      ...FILE_PATHS_ARR.flatMap(folder => [
        fs.mkdir(resolve(FILE_PUBLIC_ROOT, folder), { recursive: true }),
        fs.mkdir(resolve(FILE_REMOVED_ROOT, folder), { recursive: true }),
      ]),
    ]);
  }
}
