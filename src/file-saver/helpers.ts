import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const ALLOWED_CHAT_FILE_TYPES = new Map<string, ReadonlySet<string>>([
  ['.avif', new Set(['image/avif'])],
  ['.gif', new Set(['image/gif'])],
  ['.jfif', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
  ['.jpg', new Set(['image/jpeg'])],
  ['.png', new Set(['image/png'])],
  ['.webp', new Set(['image/webp'])],
  ['.doc', new Set(['application/msword'])],
  ['.docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])],
  ['.xls', new Set(['application/vnd.ms-excel'])],
  ['.xlsx', new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])],
  ['.ppt', new Set(['application/vnd.ms-powerpoint'])],
  ['.pptx', new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation'])],
  ['.pdf', new Set(['application/pdf'])],
  [
    '.zip',
    new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream']),
  ],
  [
    '.rar',
    new Set(['application/vnd.rar', 'application/x-rar-compressed', 'application/octet-stream']),
  ],
]);

export const nonEditFileName = (_req: any, file: any, callback: any): void => {
  const extension = extname(String(file.originalname ?? '')).toLowerCase();
  callback(
    null,
    `${randomUUID().replaceAll('-', '').slice(0, 10)}${Math.floor(Math.random() * (999999 - 111111 + 1)) + 111111}${extension}`
  );
};

export const chatFileFilter = (_req: any, file: Express.Multer.File, callback: any): void => {
  const extension = extname(String(file.originalname ?? '')).toLowerCase();
  const allowedMimeTypes = ALLOWED_CHAT_FILE_TYPES.get(extension);
  if (!allowedMimeTypes?.has(String(file.mimetype ?? '').toLowerCase())) {
    callback(
      new BadRequestException(
        'Solo se permiten imágenes, Word, Excel, PowerPoint, PDF, ZIP o RAR.'
      ),
      false
    );
    return;
  }

  callback(null, true);
};
