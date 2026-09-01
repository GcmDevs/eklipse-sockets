import { CtmType } from './base.type';


export enum AuthenticatedAs {
  USUARIO = 'usuario',
  PACIENTE = 'paciente',
  TERCERO = 'tercero'
}

export type AuthenticatedAsCode = AuthenticatedAs;

export enum GcmContexts {
  SANJUAN = 'SANJUAN',
  EKLIPSE = 'EKLIPSE',
  AGUACHICA = 'AGUACHICA',
  AMMEDICAL = 'AMMEDICAL',
  ALTACENTRO = 'ALTACENTRO',
  VALLEDUPAR = 'VALLEDUPAR',
}

export type GcmContextCode = GcmContexts;

export class GcmContextType extends CtmType<GcmContextCode> {
  constructor(
    private ekKey: number,
    code: GcmContextCode,
    forHumans: string,
    abbreviation: string | undefined,
    private numericCode: number
  ) {
    super(code, forHumans, abbreviation);
  }

  public getEkKey(): number {
    return this.ekKey;
  }

  public getNumericCode(): number {
    return this.numericCode;
  }
}

const EKLIPSE = new GcmContextType(99, GcmContexts.EKLIPSE, 'Eklipse GCM (Common DB)', 'EK', 99);
const ALTACENTRO = new GcmContextType(1, GcmContexts.ALTACENTRO, 'Centro/Alta complejidad', 'CM/AC', 2);
const AGUACHICA = new GcmContextType(3, GcmContexts.AGUACHICA, 'Alta complejidad (Aguachica)', 'AGU', 1);
const AMMEDICAL = new GcmContextType(4, GcmContexts.AMMEDICAL, 'AMMedical', 'AM', 3);
const SANJUAN = new GcmContextType(5, GcmContexts.SANJUAN, 'San Juan Bautista', 'SJ', 4);
const VALLEDUPAR = new GcmContextType(6, GcmContexts.VALLEDUPAR, 'Clinica Valledupar', 'VDP', 5);

export function gcmContextFactory(code: GcmContextCode): GcmContextType {
  switch (code) {
    case GcmContexts.SANJUAN: return SANJUAN;
    case GcmContexts.EKLIPSE: return EKLIPSE;
    case GcmContexts.AGUACHICA: return AGUACHICA;
    case GcmContexts.AMMEDICAL: return AMMEDICAL;
    case GcmContexts.ALTACENTRO: return ALTACENTRO;
    case GcmContexts.VALLEDUPAR: return VALLEDUPAR;
    default: throw new Error('No existe contexto con este codigo');
  }
}

export const GCM_CONTEXTS = { AGUACHICA, ALTACENTRO, AMMEDICAL, EKLIPSE, SANJUAN, VALLEDUPAR };

export const GCM_CONTEXTS_VALUES = Object.values(GCM_CONTEXTS);

export const ALL_CONTEXTS_WITH_AUTHORITIES = GCM_CONTEXTS_VALUES.filter((context) => context.getCode() !== GcmContexts.EKLIPSE);

export const additionalDataByCentro = (context: GcmContextType, id?: number, centroId?: number) => {
  switch (context) {
    case GCM_CONTEXTS.AGUACHICA: return { abreviattion: `${GCM_CONTEXTS.AGUACHICA.getAbbreviation()}${id || ''}`, nit: '900772387', alias1: 'AGUACHICA' };
    case GCM_CONTEXTS.AMMEDICAL: return { abreviattion: `${GCM_CONTEXTS.AMMEDICAL.getAbbreviation()}${id || ''}`, alias1: 'AMMEDICAL' };
    case GCM_CONTEXTS.SANJUAN: return { abreviattion: `${GCM_CONTEXTS.SANJUAN.getAbbreviation()}${id || ''}`, nit: '900272582', alias1: 'SAN JUAN' };
    case GCM_CONTEXTS.VALLEDUPAR: return { abreviattion: `${GCM_CONTEXTS.VALLEDUPAR.getAbbreviation()}${id || ''}`, nit: '892300708', alias1: 'VALLEDUPAR' };
    case GCM_CONTEXTS.ALTACENTRO: {
      if (centroId === 1) return { abreviattion: `CM${id || ''}`, nit: '824001041', alias1: 'CLINICA MEDICOS' };
      else if (centroId === 2) return { abreviattion: `AC${id || ''}`, nit: '9006124131', alias1: 'ALTA COMPLEJIDAD' };
      else return { abreviattion: `CPS${id || ''}`, nit: '8923007081', alias1: 'CAPS' };
    }
  }
};
