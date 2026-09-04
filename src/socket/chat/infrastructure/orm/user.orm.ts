import { TIPOS_USUARIO, TipoUsuarioCode } from '@common/domain/types';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('CHATUSUREG')
@Index('UQ_CHATUSUREG_USUDOCUME', ['document'], { unique: true })
export class ChatUserOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'USUDOCUME' })
  document: string;

  @Column({ name: 'USUDESCRI' })
  fullName: string;

  @Column({ name: 'TIPOUSUARIO', type: 'smallint', default: TIPOS_USUARIO.USUARIO.getCode() })
  typeCode: TipoUsuarioCode;
}
