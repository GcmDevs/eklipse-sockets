import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { _PrivSecUserOrm } from './user.orm';
import { _PrivSecAuthOrm } from './authority.orm';
import { RSAServices } from '../../application/services';

@Entity('GENROL')
export class _PrivSecRoleOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'ROLNOMBRE' })
  name: string;

  @OneToMany(() => _PrivSecUserOrm, user => user.role)
  users: _PrivSecUserOrm[];

  @ManyToMany(() => _PrivSecAuthOrm, authority => authority.roles)
  @JoinTable({
    name: 'GCMMODULOROL',
    joinColumn: { name: 'GENROL', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'GCMMODULO', referencedColumnName: 'id' },
  })
  authorities: _PrivSecAuthOrm[];

  public encryptId() {
    this.id = RSAServices.encryptId(this.id) as any;
  }

  public decryptId() {
    this.id = RSAServices.decryptId(this.id as any);
  }
}
