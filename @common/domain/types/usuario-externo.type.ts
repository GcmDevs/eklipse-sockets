import { CtmType } from './base.type';

export type UsuExtCode = 1 | 2 | 3;

export class UsuExtType extends CtmType<UsuExtCode> {}

const GENUSUARIO = new UsuExtType(1, 'GENUSUARIO');
const GENTERCERP = new UsuExtType(2, 'GENTERCERP');
const GENPACIEN = new UsuExtType(3, 'GENPACIEN');

export function usuExtTypeFactory(code: UsuExtCode): UsuExtType {
  switch (code) {
    case 1: return GENUSUARIO;
    case 2: return GENTERCERP;
    case 3: return GENPACIEN;
    default: throw new Error('No existe usuario externo de este tipo');
  }
}

export const USU_EXTS = { GENUSUARIO, GENTERCERP, GENPACIEN };

export const USU_EXTS_VALUES = Object.values(USU_EXTS);
