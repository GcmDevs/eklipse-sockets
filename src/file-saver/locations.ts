import { isAbsolute, posix, relative, resolve } from 'path';

export const FILE_PATHS = {
  chat: {
    files: 'chat/files',
  },
  testing: 'testing',
} as const;

export const DISTRIBUTED_BY_DOCUMENT = [FILE_PATHS.chat.files] as const;

const getFilePaths = (obj: object): string[] =>
  Object.values(obj).flatMap(value => (typeof value === 'string' ? [value] : getFilePaths(value)));

export const FILE_PATHS_ARR = getFilePaths(FILE_PATHS);

export const MAX_CHAT_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_CHAT_FILES_PER_MESSAGE = 10;

export const FILE_TEMP_ROOT = resolve(process.cwd(), 'temp');
export const FILE_PUBLIC_ROOT = resolve(process.cwd(), 'public');
export const FILE_REMOVED_ROOT = resolve(process.cwd(), 'removed');

export const normalizeStoredFilePath = (value: string): string =>
  String(value ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/+/, '');

export const managedStoredFilePath = (folder: string, fileName: string): string =>
  posix.join('public', folder, fileName);

export const isManagedStoredFilePath = (value: unknown, folder?: string): value is string => {
  if (typeof value !== 'string') return false;

  const normalized = normalizeStoredFilePath(value);
  if (normalized.split('/').some(segment => segment === '.' || segment === '..')) return false;
  const allowedFolders = folder ? [folder] : FILE_PATHS_ARR;
  return allowedFolders.some(allowedFolder => {
    const prefix = `public/${allowedFolder}/`;
    return normalized.startsWith(prefix) && normalized.length > prefix.length;
  });
};

export const resolveStoredPublicFile = (value: string): string => {
  if (!isManagedStoredFilePath(value)) throw new Error('La ubicación del archivo no es válida.');

  const normalized = normalizeStoredFilePath(value);
  const absolutePath = resolve(FILE_PUBLIC_ROOT, normalized.slice('public/'.length));
  const relativePath = relative(FILE_PUBLIC_ROOT, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('La ubicación del archivo no es válida.');
  }

  return absolutePath;
};
