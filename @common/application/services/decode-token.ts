import {
  GcmContextCode,
  GcmContextType,
  TIPOS_USUARIO,
  TipoUsuarioCode,
  TipoUsuarioType,
  gcmContextFactory,
  tipoUsuarioTypeFactory,
} from '../../domain/types';
import { jwtDecode } from 'jwt-decode';
import { RSAServices } from './rsa';

export interface IAuthToken {
  jti: string;
  pid: string;
  sub: GcmContextCode;
  dcm: string;
  fnm: string;
  rol: TipoUsuarioCode;
  rst: boolean;
  iat?: number;
  exp?: number;
}

export interface ITokenDecoded {
  user: {
    id: number;
    document: string;
    fullName: string;
    patientId: number;
  };
  passWasReset: boolean;
  role: TipoUsuarioType;
  context: GcmContextType;
  createdAt: Date;
  expiredAt: Date;
}

const _tokenDateToDate = (date: number): Date => {
  const initOfTimes = new Date(0);
  return new Date(initOfTimes.setUTCSeconds(date));
};

const decodeToken = (token: string): ITokenDecoded => {
  try {
    const tkDcd: IAuthToken = jwtDecode(token);

    const tkFt: ITokenDecoded = {
      user: {
        id: RSAServices.decryptId(tkDcd.jti),
        document: tkDcd.dcm,
        fullName: tkDcd.fnm,
        patientId: tkDcd.pid ? RSAServices.decryptId(tkDcd.pid) : null!,
      },
      role: tkDcd.rol ? tipoUsuarioTypeFactory(tkDcd.rol) : TIPOS_USUARIO.USUARIO,
      passWasReset: tkDcd.rst,
      context: gcmContextFactory(tkDcd.sub),
      createdAt: _tokenDateToDate(tkDcd.iat),
      expiredAt: _tokenDateToDate(tkDcd.exp),
    };

    return tkFt;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const JWTServices = { decodeToken };
