import { Entity, PrimaryGeneratedColumn, Column, OneToMany, JoinColumn, ManyToOne } from 'typeorm';
import { _PrivSecAuthOrm } from './authority.orm';
import { _PrivSecModuleOrm } from './module.orm';
import { RSAServices } from '../../application/services';

@Entity('EKGENSUBMODULO')
export class _PrivSecSubModuleOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CODIGO' })
  code: string;

  @Column({ name: 'NOMBRE' })
  name: string;

  @Column({ name: 'ACTIVO' })
  isActive: boolean;

  @Column({ name: 'EKGENMODULO' })
  moduleId: number;

  @ManyToOne(() => _PrivSecModuleOrm, module => module.authorities)
  @JoinColumn({ name: 'EKGENMODULO' })
  module: _PrivSecModuleOrm;

  @OneToMany(() => _PrivSecAuthOrm, authority => authority.subModule)
  authorities: _PrivSecAuthOrm[];

  public encryptId() {
    this.id = RSAServices.encryptId(this.id) as any;
  }

  public decryptId() {
    this.id = RSAServices.decryptId(this.id as any);
  }
}
