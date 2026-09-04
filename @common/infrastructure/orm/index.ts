import { _PrivSecAuthOrm } from './authority.orm';
import { _PrivSecModuleOrm } from './module.orm';
import { _PrivSecRoleOrm } from './role.orm';
import { _PrivSecSubModuleOrm } from './sub-module.orm';
import { _PrivSecUserOrm } from './user.orm';

export const _PRIV_ORM_AUTH_SEC_ENTITIES = [
  _PrivSecAuthOrm,
  _PrivSecModuleOrm,
  _PrivSecRoleOrm,
  _PrivSecSubModuleOrm,
  _PrivSecUserOrm,
];
