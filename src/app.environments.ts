import { generateApiUrlBase, GLOBAL_VALID_HOSTS, processEnv } from '@env';

const production = processEnv.PRODUCTION;
const showDocs = processEnv.SHOW_DOCS;
const isHttps = processEnv.IS_HTTPS;
const apiUrlBase = generateApiUrlBase();
const port = 8005;

export const ENVIRONMENTS = {
  production,
  showDocs,
  isHttps,
  port,
  apiUrl: production ? `${apiUrlBase}:${port}` : `${apiUrlBase}:${port}`,
  apiUrlBase,
  chatEncryptionKey: processEnv.CHAT_ENCRYPTION_KEY,
};

export const VALID_HOSTS = GLOBAL_VALID_HOSTS;
