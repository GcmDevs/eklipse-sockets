import { Reflector } from '@nestjs/core';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ADMIN_AUTHORITY } from '../../application/constants';
import { JWTServices } from '../../application/services';
import { fetchAuthsByUser } from '../services';

@Injectable()
export class AuthoritiesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authorities = this.reflector.get<string[]>('authorities', context.getHandler());
    if (!authorities) return true;

    const tk = context.switchToHttp().getRequest().headers.authorization.split(' ')[1];

    const tkDcd = JWTServices.decodeToken(tk);

    if (tkDcd.passWasReset) throw new Error('Debes cambiar tu contraseña antes de continuar');

    let userAuthorities: string[] = [];

    authorities.push(ADMIN_AUTHORITY);
    const res = await fetchAuthsByUser({ tk });
    userAuthorities = res.onlyCodes;

    const hasAnyAuthority = () =>
      userAuthorities.some((authority: string) => authorities.includes(authority));

    return hasAnyAuthority();
  }
}
