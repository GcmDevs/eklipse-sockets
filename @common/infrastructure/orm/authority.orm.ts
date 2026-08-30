import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ManyToMany } from 'typeorm';
import { RSAServices } from '../../application/services';
import { _PrivSecSubModuleOrm } from './sub-module.orm';
import { _PrivSecModuleOrm } from './module.orm';
import { _PrivSecUserOrm } from './user.orm';
import { _PrivSecRoleOrm } from './role.orm';

@Entity('GCMMODULOS')
export class _PrivSecAuthOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'EKCODIGO' })
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

  @Column({ name: 'EKGENSUBMODULO' })
  subModuleId: number;

  @ManyToOne(() => _PrivSecSubModuleOrm, subModule => subModule.authorities)
  @JoinColumn({ name: 'EKGENSUBMODULO' })
  subModule: _PrivSecSubModuleOrm;

  @ManyToMany(() => _PrivSecRoleOrm, role => role.authorities)
  roles: _PrivSecRoleOrm[];

  @ManyToMany(() => _PrivSecUserOrm, user => user.authorities)
  users: _PrivSecUserOrm[];

  isByRol?: boolean;

  public encryptId() {
    this.id = RSAServices.encryptId(this.id) as any;
  }

  public decryptId() {
    this.id = RSAServices.decryptId(this.id as any);
  }
}
