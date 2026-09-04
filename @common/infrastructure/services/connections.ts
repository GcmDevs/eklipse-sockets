import { DataSource, EntitySchema, EntityTarget } from 'typeorm';
import { GCM_CONTEXTS, GcmContextType } from '../../domain/types';
import { _PRIV_ORM_AUTH_SEC_ENTITIES } from '../orm';
import { processEnv } from '@env';

const type = 'mssql';
const port = 1433;
const encrypt = false;
const logging = false;
const options = {
  encrypt,
  cryptoCredentialsDetails: {
    minVersion: 'TLSv1',
  },
};
const extra = {
  trustServerCertificate: true,
};

let entities: EntitySchema<any>[] = [];
let socketEntities: EntitySchema<any>[] = [];

export const AGU_DS = new DataSource({
  host: processEnv.AGU_HOST_DB,
  username: processEnv.AGU_USERNAME_DB,
  password: processEnv.AGU_PASS_DB,
  database: processEnv.AGU_NAME_DB,
  synchronize: false,
  type,
  port,
  logging,
  entities,
  options,
  extra,
});

export const AC_DS = new DataSource({
  host: processEnv.AC_HOST_DB,
  username: processEnv.AC_USERNAME_DB,
  password: processEnv.AC_PASS_DB,
  database: processEnv.AC_NAME_DB,
  synchronize: false,
  type,
  port,
  logging,
  entities,
  options,
  extra,
});

export const AMM_DS = new DataSource({
  host: processEnv.AMM_HOST_DB,
  username: processEnv.AMM_USERNAME_DB,
  password: processEnv.AMM_PASS_DB,
  database: processEnv.AMM_NAME_DB,
  synchronize: false,
  type,
  port,
  logging,
  entities,
  options,
  extra,
});

export const SJ_DS = new DataSource({
  host: processEnv.SJ_HOST_DB,
  username: processEnv.SJ_USERNAME_DB,
  password: processEnv.SJ_PASS_DB,
  database: processEnv.SJ_NAME_DB,
  synchronize: false,
  type,
  port,
  logging,
  entities,
  options,
  extra,
});

export const VDP_DS = new DataSource({
  host: processEnv.VDP_HOST_DB,
  username: processEnv.VDP_USERNAME_DB,
  password: processEnv.VDP_PASS_DB,
  database: processEnv.VDP_NAME_DB,
  synchronize: false,
  type,
  port,
  logging,
  entities,
  options,
  extra,
});

export const SKS_DS = new DataSource({
  host: processEnv.SKS_HOST_DB,
  username: processEnv.SKS_USERNAME_DB,
  password: processEnv.SKS_PASS_DB,
  database: processEnv.SKS_NAME_DB,
  synchronize: false,
  type: 'postgres',
  port: 5432,
  entities: socketEntities,
  invalidWhereValuesBehavior: {
    null: 'ignore',
    undefined: 'ignore',
  },
});

const logs = (success: boolean, ctx: string, err?: any): void => {
  if (success) console.log(`Db connection success,`, `${ctx} was started`);
  else
    console.log(
      `Db connection fail,`,
      `${ctx} was not started, ${err ? `error detail: ${err.message}` : ''}`
    );
};

export const initializeSources = (entities: EntityTarget<unknown>[]) => {
  if (processEnv.CONNECT_WITH_DB) {
    if (entities) entities.push(..._PRIV_ORM_AUTH_SEC_ENTITIES);
    (AGU_DS.options.entities as EntityTarget<unknown>[]).push(...entities);
    (AC_DS.options.entities as EntityTarget<unknown>[]).push(...entities);
    (AMM_DS.options.entities as EntityTarget<unknown>[]).push(...entities);
    (SJ_DS.options.entities as EntityTarget<unknown>[]).push(...entities);
    (VDP_DS.options.entities as EntityTarget<unknown>[]).push(...entities);

    AGU_DS.initialize()
      .then(() => logs(true, GCM_CONTEXTS.AGUACHICA.getCode()))
      .catch(err => logs(false, GCM_CONTEXTS.AGUACHICA.getCode(), err));

    AC_DS.initialize()
      .then(() => logs(true, GCM_CONTEXTS.ALTACENTRO.getCode()))
      .catch(err => logs(false, GCM_CONTEXTS.ALTACENTRO.getCode(), err));

    AMM_DS.initialize()
      .then(() => logs(true, GCM_CONTEXTS.AMMEDICAL.getCode()))
      .catch(err => logs(false, GCM_CONTEXTS.AMMEDICAL.getCode(), err));

    SJ_DS.initialize()
      .then(() => logs(true, GCM_CONTEXTS.SANJUAN.getCode()))
      .catch(err => logs(false, GCM_CONTEXTS.SANJUAN.getCode(), err));

    VDP_DS.initialize()
      .then(() => logs(true, GCM_CONTEXTS.VALLEDUPAR.getCode()))
      .catch(err => logs(false, GCM_CONTEXTS.VALLEDUPAR.getCode(), err));
  }
};

export const initializeEkSources = (entities: EntityTarget<unknown>[]) => {
  if (processEnv.CONNECT_WITH_DB) {
    (SKS_DS.options.entities as EntityTarget<unknown>[]).push(...entities);

    SKS_DS.initialize()
      .then(() => logs(true, 'Sockets Database'))
      .catch(err => logs(false, 'Sockets Database', err));
  }
};

export const switchConn = (ctx: GcmContextType) => {
  switch (ctx) {
    case GCM_CONTEXTS.AGUACHICA:
      return AGU_DS;
    case GCM_CONTEXTS.ALTACENTRO:
      return AC_DS;
    case GCM_CONTEXTS.SANJUAN:
      return SJ_DS;
    case GCM_CONTEXTS.VALLEDUPAR:
      return VDP_DS;
    case GCM_CONTEXTS.AMMEDICAL:
      return AMM_DS;
    default:
      throw new Error('No existe datasource con este contexto');
  }
};

export const switchSocketsConn = () => SKS_DS;
