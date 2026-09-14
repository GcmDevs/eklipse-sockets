import { CtmType } from '@common/domain/types';

export type EntidadCode = 1;

export class EntidadType extends CtmType<EntidadCode> {}

const CTCSOLI = new EntidadType(1, 'Solicitud (central de compras)');

export function entidadTypeFactory(code: EntidadCode): EntidadType {
  switch (code) {
    case 1:
      return CTCSOLI;
    default:
      throw new Error('No existe este tipo de entidad');
  }
}

export const TIPOS_ENTIDAD = { CTCSOLI };

export const TIPOS_ENTIDAD_VALUES = Object.values(TIPOS_ENTIDAD);
