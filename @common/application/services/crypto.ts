import * as bcrypt from 'bcrypt';

const compare = async (passByUser: string, passEncrypted: string) => {
  const result = await bcrypt.compare(passByUser, passEncrypted);
  return result;
};

const encrypt = async (password: string) => {
  const result = await bcrypt.hash(password, 10);
  return result;
};

export const CRYPTO_SERVICES = {
  compare,
  encrypt,
};
