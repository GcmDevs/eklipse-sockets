import {
  GcmContextCode,
  GcmContextType,
  USU_EXTS,
  UsuExtCode,
  UsuExtType,
  gcmContextFactory,
  usuExtTypeFactory,
} from '../../domain/types';
import { jwtDecode } from 'jwt-decode';
import { RSAServices } from './rsa';

export interface IAuthToken {
  jti: string;
  sub: GcmContextCode;
  dcm: string;
  fnm: string;
  dim: boolean;
  tue: UsuExtCode;
  rst: boolean;
  iat?: number;
  exp?: number;
}

export interface ITokenDecoded {
  user: {
    id: number;
    document: string;
    fullName: string;
  };
  isDim: boolean;
  tipoUsuExt: UsuExtType;
  passWasReset: boolean;
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
      user: { id: RSAServices.decryptId(tkDcd.jti), document: tkDcd.dcm, fullName: tkDcd.fnm },
      isDim: tkDcd.dim === undefined ? true : tkDcd.dim,
      tipoUsuExt: tkDcd.tue === undefined ? USU_EXTS.GENUSUARIO : usuExtTypeFactory(tkDcd.tue),
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
