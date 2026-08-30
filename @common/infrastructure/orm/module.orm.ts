import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { _PrivSecAuthOrm } from './authority.orm';
import { _PrivSecSubModuleOrm } from './sub-module.orm';
import { RSAServices } from '../../application/services';

@Entity('EKGENMODULO')
export class _PrivSecModuleOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CODIGO' })
  code: string;

  @Column({ name: 'NOMBRE' })
  name: string;

  @Column({ name: 'ACTIVO' })
  isActive: boolean;

  @OneToMany(() => _PrivSecAuthOrm, authority => authority.module)
  authorities: _PrivSecAuthOrm[];

  @OneToMany(() => _PrivSecSubModuleOrm, subModule => subModule.module)
  subModules: _PrivSecSubModuleOrm[];

  public encryptId() {
    this.id = RSAServices.encryptId(this.id) as any;
  }

  public decryptId() {
    this.id = RSAServices.decryptId(this.id as any);
  }
}
