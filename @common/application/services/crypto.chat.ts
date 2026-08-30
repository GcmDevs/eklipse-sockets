import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const algorithm = 'aes-256-gcm';

const getKey = (): Buffer => {
  const key = Buffer.from(process.env.CHAT_ENCRYPTION_KEY!, 'base64');
  if (key.length !== 32) throw new Error('CHAT_ENCRYPTION_KEY debe tener 32 bytes');
  return key;
};

const encrypt = (text: string): Buffer => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
};

const decrypt = (data: Buffer): string => {
  if ((data as any) === null) return '';
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv(algorithm, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

export const CRYPTO_CHAT_SERVICES = {
  encrypt,
  decrypt,
};
