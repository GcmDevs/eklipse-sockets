import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { RSAServices } from '@common/application/services';
import { GcmContextCode, gcmContextFactory } from '@common/domain/types';
import { processEnv } from '@env';
import { SocketClientRegistry } from './common/client-registry';
import { SOCKET_GATEWAY_OPTIONS } from './common/constants';
import { normalizeSocketDocument, type SocketUser } from './common/types';

@WebSocketGateway(SOCKET_GATEWAY_OPTIONS)
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly clients: SocketClientRegistry) {}

  afterInit(server: Namespace): void {
    server.use((client, next) => {
      try {
        client.data.socketUser = this.authenticate(client);
        next();
      } catch {
        next(new Error('Tu sesión no es válida. Inicia sesión nuevamente.'));
      }
    });
  }

  handleConnection(client: Socket): void {
    const user = client.data.socketUser as SocketUser | undefined;
    if (!user) {
      client.disconnect(true);
      return;
    }

    this.clients.register(user.document, client);
  }

  handleDisconnect(client: Socket): void {
    this.clients.unregister(client);
  }

  private authenticate(client: Socket): SocketUser {
    try {
      const tokenFromAuth = client.handshake.auth?.token;
      const authorization = client.handshake.headers.authorization;
      const tokenFromHeader = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : undefined;
      const token = typeof tokenFromAuth === 'string' ? tokenFromAuth : tokenFromHeader;

      if (!token) throw new Error('Token not found');

      const decoded = (
        processEnv.PRODUCTION ? jwt.verify(token, processEnv.JWT_SECRET_KEY) : jwt.decode(token)
      ) as JwtPayload | null;

      const document = normalizeSocketDocument(decoded?.dcm);
      const name = typeof decoded?.fnm === 'string' ? decoded.fnm.trim() : '';
      const clientApp =
        typeof client.handshake.auth?.clientApp === 'string'
          ? client.handshake.auth.clientApp.trim()
          : '';

      //
      const role = ['USUARIO', 'PACIENTE'].indexOf(decoded?.rol) >= 1 ? decoded.rol : 'USUARIO';
      if (!decoded?.jti || !decoded?.sub || !document || !name || !role) {
        throw new Error('Invalid token payload');
      }

      const userId = Number(RSAServices.decryptId(decoded.jti));
      const centerId = gcmContextFactory(decoded.sub as GcmContextCode).getEkKey();
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        throw new Error('Invalid user identity');
      }

      return {
        id: decoded.jti,
        userId,
        centerId,
        context: decoded.sub,
        document,
        name,
        role,
        clientApp,
      };
    } catch (error) {
      console.log(error);
    }
  }
}
