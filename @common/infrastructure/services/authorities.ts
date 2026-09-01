import { BadRequestException } from '@nestjs/common';
import { GcmContextType } from '../../domain/types';
import { ITokenDecoded, JWTServices, RSAServices } from '../../application/services';
import { _PrivSecAuthOrm } from '../orm/authority.orm';
import { _PrivSecUserOrm } from '../orm/user.orm';
import { switchConn } from './connections';
import { uniq } from 'lodash';

export const fetchAuthsByUser = async (p: { id?: number; ctx?: GcmContextType; tk?: string }) => {
  let { id, ctx, tk } = p;
  try {
    if (tk) {
      let tkDcd: ITokenDecoded = JWTServices.decodeToken(tk);
      id = tkDcd.user.id;
      ctx = tkDcd.context;
    }
    if (!id || !ctx) throw new Error('No existe id de usuario o contexto para consultar');
    const conn = switchConn(ctx);
    const userRp = conn.getRepository(_PrivSecUserOrm);
    const user = await userRp.findOne({
      where: { id },
      relations: [
        'authorities',
        'authorities.module',
        'authorities.subModule',
        'role',
        'role.authorities',
        'role.authorities.module',
        'role.authorities.subModule',
      ],
    });

    const authorities: _PrivSecAuthOrm[] = [];

    const authoritiesByUser = user.authorities.map(el => {
      el.isByRol = false;
      let authority = '';

      if (el.module) {
        authority += el.module.code;
        if (el.isActive) el.isActive = el.module.isActive;
      } else {
        delete el.module;
      }

      if (el.subModule) {
        authority += el.subModule.code;
        if (el.isActive) el.isActive = el.subModule.isActive;
      } else {
        delete el.subModule;
      }

      authority += el.code;

      if (el.isActive) {
        el.code = authority;
        return el;
      } else {
        return null;
      }
    });

    const authoritiesByRole = user.role.authorities.map(el => {
      el.isByRol = true;
      let authority = '';

      if (el.module) {
        authority += el.module.code;
        if (el.isActive) el.isActive = el.module.isActive;
      } else {
        delete el.module;
        delete el.moduleId;
      }

      if (el.subModule) {
        authority += el.subModule.code;
        if (el.isActive) el.isActive = el.subModule.isActive;
      } else {
        delete el.subModule;
        delete el.subModuleId;
      }

      authority += el.code;

      if (el.isActive) {
        el.code = authority;
        return el;
      } else {
        return null;
      }
    });

    authorities.push(
      ...uniq([
        ...authoritiesByUser.filter(el => el !== null),
        ...authoritiesByRole.filter(el => el !== null),
      ])
    );

    const codes: string[] = [];

    authorities.map(el => {
      if (el.module) {
        delete el.module.isActive;
        codes.push(el.module.code);
        el.module.id = RSAServices.encryptId(el.module.id) as any;
        delete el.moduleId;
      }
      if (el.subModule) {
        delete el.subModule.isActive;
        codes.push(`${el.module.code}${el.subModule.code}`);
        el.subModule.id = RSAServices.encryptId(el.subModule.id) as any;
        delete el.subModule.moduleId;
        delete el.subModuleId;
      }
      codes.push(el.code);
      delete el.isActive;
      el.id = RSAServices.encryptId(el.id) as any;
    });

    return { authorities, onlyCodes: uniq(codes) };
  } catch (error: any) {
    throw new BadRequestException(error.message);
  }
};

export const fetchAuths = async (ctx: GcmContextType) => {
  try {
    const conn = switchConn(ctx);

    const authorityRp = conn.getRepository(_PrivSecAuthOrm);

    const allAuthorities = await authorityRp.find({
      relations: ['module', 'subModule'],
    });

    const authorities = allAuthorities.map(el => {
      delete el.isByRol;
      let authority = '';

      if (el.module) {
        authority += el.module.code;
        if (el.isActive) el.isActive = el.module.isActive;
      } else {
        delete el.module;
        delete el.moduleId;
      }

      if (el.subModule) {
        authority += el.subModule.code;
        if (el.isActive) el.isActive = el.subModule.isActive;
      } else {
        delete el.subModule;
        delete el.subModuleId;
      }

      authority += el.code;

      if (el.isActive) {
        el.code = authority;
        return el;
      } else {
        return null;
      }
    });

    const codes: string[] = [];

    const authoritiesFiltered = authorities.filter(el => el !== null);

    authoritiesFiltered.map(el => {
      if (el.module) {
        delete el.module.isActive;
        codes.push(el.module.code);
        el.module.id = RSAServices.encryptId(el.module.id) as any;
        delete el.moduleId;
      }
      if (el.subModule) {
        delete el.subModule.isActive;
        codes.push(el.module ? el.module.code : '' + el.subModule.code);
        el.subModule.id = RSAServices.encryptId(el.subModule.id) as any;
        delete el.subModule.moduleId;
        delete el.subModuleId;
      }
      codes.push(el.code);
      delete el.isActive;
      el.id = RSAServices.encryptId(el.id) as any;
    });

    return { authorities: authoritiesFiltered, onlyCodes: uniq(codes) };
  } catch (error: any) {
    throw new BadRequestException(error.message);
  }
};
