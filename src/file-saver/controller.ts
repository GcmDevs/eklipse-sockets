import {
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  Controller,
  Delete,
  Query,
  Req,
  Post,
  Body,
  Inject,
} from '@nestjs/common';
import type { Request } from 'express';
import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { diskStorage } from 'multer';
import { ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  FILE_PATHS_ARR,
  FILE_PUBLIC_ROOT,
  FILE_REMOVED_ROOT,
  FILE_TEMP_ROOT,
  MAX_CHAT_FILE_SIZE,
  MAX_CHAT_FILES_PER_MESSAGE,
  managedStoredFilePath,
  normalizeStoredFilePath,
  resolveStoredPublicFile,
  DISTRIBUTED_BY_DOCUMENT,
} from './locations';
import { CommonGuards } from '@common/presentation/decorators';
import { chatFileFilter, nonEditFileName } from './helpers';
import { ITokenDecoded, JWTServices } from '@common/application/services';
import { FileServerRegistry } from './registry';
import { REQUEST } from '@nestjs/core';

@ApiTags('FileSaver')
@CommonGuards()
@Controller('file-saver')
export class FileSaverController {
  constructor(
    @Inject(REQUEST) private _request: Request,
    private readonly registry: FileServerRegistry
  ) {}

  protected getTokenDecoded(): ITokenDecoded {
    const tkDcd = JWTServices.decodeToken(this._request.headers.authorization!.split(' ')[1]);
    return tkDcd;
  }

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['folder', 'files'],
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        folder: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'files', maxCount: MAX_CHAT_FILES_PER_MESSAGE }], {
      storage: diskStorage({ destination: FILE_TEMP_ROOT, filename: nonEditFileName }),
      limits: { fileSize: MAX_CHAT_FILE_SIZE, files: MAX_CHAT_FILES_PER_MESSAGE },
      fileFilter: chatFileFilter,
    })
  )
  @Post()
  public async addFiles(
    @UploadedFiles() files: { files?: Express.Multer.File[] },
    @Body() body: { folder: string },
    @Req() request: Request
  ): Promise<string[]> {
    const uploadedFiles = files?.files ?? [];
    try {
      const ownerDocument = this.ownerDocument(request);
      const storedPaths = await this.storeFiles(uploadedFiles, body?.folder);
      this.registry.register(storedPaths, ownerDocument);
      return storedPaths;
    } catch (error: any) {
      await this.removeTemporaryFiles(uploadedFiles);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(error.message);
    }
  }

  @ApiQuery({ name: 'paths', type: String, isArray: true, required: true })
  @ApiQuery({ name: 'deleteForever', type: Boolean, required: false })
  @Delete()
  public async removeFiles(
    @Query('paths') paths: string[],
    @Query('deleteForever') deleteForever: boolean,
    @Req() request: Request
  ): Promise<boolean> {
    try {
      const requestedPaths = Array.isArray(paths) ? paths : paths ? [paths] : [];
      const ownerDocument = this.ownerDocument(request);

      if (!this.registry.canDelete(requestedPaths, ownerDocument)) {
        throw new BadRequestException('Los archivos ya no están disponibles para eliminarse.');
      }

      for (const storedPath of requestedPaths) {
        const source = resolveStoredPublicFile(storedPath);
        if (deleteForever) {
          await fs.rm(source, { force: true });
          continue;
        }

        const normalized = normalizeStoredFilePath(storedPath);
        const destination = resolve(FILE_REMOVED_ROOT, normalized.slice('public/'.length));
        await fs.mkdir(dirname(destination), { recursive: true });
        try {
          await fs.rename(source, destination);
        } catch (error: any) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
      this.registry.complete(requestedPaths, ownerDocument);
      return true;
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(error.message);
    }
  }

  private async storeFiles(files: Express.Multer.File[], folderValue: string): Promise<string[]> {
    let folder = String(folderValue ?? '').replaceAll('-', '/');

    if (!FILE_PATHS_ARR.includes(folder)) {
      throw new BadRequestException('La carpeta de destino no es válida.');
    }

    if (!files.length) throw new BadRequestException('Selecciona al menos un archivo.');

    if (DISTRIBUTED_BY_DOCUMENT.includes(folder as any)) {
      folder = folder.concat(`/${this.getTokenDecoded().user.document}`);
    }

    const storedPaths = files.map(file => managedStoredFilePath(folder, file.filename));
    const destinations = storedPaths.map(storedPath => resolveStoredPublicFile(storedPath));

    try {
      await fs.mkdir(resolve(FILE_PUBLIC_ROOT, folder), { recursive: true });
      const moves = await Promise.allSettled(
        files.map((file, index) => fs.rename(file.path, destinations[index]))
      );
      const failedMove = moves.find(move => move.status === 'rejected');
      if (failedMove?.status === 'rejected') throw failedMove.reason;
      return storedPaths;
    } catch (error) {
      await Promise.all([
        ...files.map(file => fs.rm(file.path, { force: true })),
        ...destinations.map(destination => fs.rm(destination, { force: true })),
      ]);
      throw error;
    }
  }

  private async removeTemporaryFiles(files: Express.Multer.File[]): Promise<void> {
    await Promise.all(files.map(file => fs.rm(file.path, { force: true })));
  }

  private ownerDocument(request: Request): string {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new BadRequestException('No fue posible identificar al propietario.');
    return JWTServices.decodeToken(token).user.document;
  }
}
