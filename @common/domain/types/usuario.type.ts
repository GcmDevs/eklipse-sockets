import { CtmType } from './base.type';

export type TipoUsuarioCode = 1 | 2 | 3;

export class TipoUsuarioType extends CtmType<TipoUsuarioCode> {}

const USUARIO = new TipoUsuarioType(1, 'USUARIO');
const TERCERO = new TipoUsuarioType(2, 'TERCERO');
const PACIENTE = new TipoUsuarioType(3, 'PACIENTE');

export function tipoUsuarioTypeFactory(code: TipoUsuarioCode): TipoUsuarioType {
  switch (code) {
    case 1: return USUARIO;
    case 2: return TERCERO;
    case 3: return PACIENTE;
    default: throw new Error('No existe este tipo de usuario');
  }
}

export const TIPOS_USUARIO = {  USUARIO, TERCERO, PACIENTE };

export const TIPOS_USUARIO_VALUES = Object.values(TIPOS_USUARIO);
