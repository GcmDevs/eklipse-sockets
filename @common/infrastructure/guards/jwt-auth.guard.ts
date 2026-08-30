import { processEnv } from '@env';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    try {
      const token = context.switchToHttp().getRequest().headers.authorization.split(' ')[1];
      if (processEnv.PRODUCTION) jwt.verify(token, processEnv.JWT_SECRET_KEY);
      else {
        const tkDcd = jwt.decode(token);
        if (!tkDcd) throw new Error('In development, you need at least a real token');
      }
      return true;
    } catch (error: any) {
      throw new UnauthorizedException(error.message);
    }
  }
}
