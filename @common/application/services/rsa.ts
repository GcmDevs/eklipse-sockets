import * as NodeRSA from 'node-rsa';
import * as fs from 'fs';

const RSA = {
  ids: {
    publicKey: new NodeRSA(fs.readFileSync('./rsa/ids/public.pem', 'utf8')),
    privateKey: new NodeRSA(fs.readFileSync('./rsa/ids/private.pem', 'utf8')),
  },
};

const encryptId = (id: number) => {
  const keyPublic = RSA.ids.publicKey;
  let encrypted = keyPublic.encrypt(`${id}`, 'base64');
  encrypted = encrypted.replaceAll('+', '_').replaceAll('/', '.');
  return encrypted;
};

const decryptId = (encryptedId: string) => {
  const idIsNumber = !isNaN(+encryptedId);
  if (idIsNumber) return +encryptedId;

  encryptedId = encryptedId.replaceAll('_', '+').replaceAll('.', '/');

  const keyPrivate = RSA.ids.privateKey;
  const decrypt = keyPrivate.decrypt(encryptedId, 'utf8');

  return +decrypt;
};

const generateKeys = (bytes = 512) => {
  const keys = new NodeRSA({ b: bytes });
  const publicKey = keys.exportKey('public');
  const privateKey = keys.exportKey('private');

  return { publicKey, privateKey };
};

export const RSAServices = {
  encryptId,
  decryptId,
  generateKeys,
};
