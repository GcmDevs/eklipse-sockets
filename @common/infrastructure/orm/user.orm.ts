import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  JoinTable,
  ManyToMany,
} from 'typeorm';
import { _PrivSecRoleOrm } from './role.orm';
import { _PrivSecAuthOrm } from './authority.orm';
import { RSAServices } from '../../application/services';

@Entity('GENUSUARIO')
export class _PrivSecUserOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @ManyToOne(() => _PrivSecRoleOrm, role => role.users)
  @JoinColumn({ name: 'GENROL' })
  role: _PrivSecRoleOrm;

  @Column({ name: 'USUDESCRI' })
  fullName: string;

  @Column({ name: 'USUNOMBRE' })
  document: string;

  @Column({ name: 'USUCLAVE' })
  password: string;

  @Column({ name: 'USUESTADO' })
  statusCode: number;

  @Column({ name: 'USUULTAUT' })
  lastAuth: Date;

  @ManyToMany(() => _PrivSecAuthOrm, authority => authority.users)
  @JoinTable({
    name: 'GCMUSUPERMISO',
    joinColumn: { name: 'IDUSUARIO', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'IDMODULO', referencedColumnName: 'id' },
  })
  authorities: _PrivSecAuthOrm[];

  public encryptId() {
    this.id = RSAServices.encryptId(this.id) as any;
  }

  public decryptId() {
    this.id = RSAServices.decryptId(this.id as any);
  }
}
