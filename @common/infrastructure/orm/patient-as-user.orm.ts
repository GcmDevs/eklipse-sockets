import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { _PrivSecPacAreaOrm } from './patient-area.orm';

@Entity('APPACUSUARIO')
export class _PrivSecPacAsUserOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'GENPACIEN' })
  pacientId: number;

  @Column({ name: 'DOCUMENTO' })
  document: string;

  @Column({ name: 'NOMCOM' })
  fullName: string;

  @Column({ name: 'PASSWORD', select: false })
  password: string;

  @Column({ name: 'ESTADO' })
  statusCode: number;

  @Column({ name: 'LASTAUTH' })
  lastAuth: Date;

  @Column({ name: 'ISRESET' })
  passwordIsReset: boolean;

  @ManyToMany(() => _PrivSecPacAreaOrm, area => area.pacientes)
  @JoinTable({
    name: 'APPACUSUARIOAREA',
    joinColumn: { name: 'APPACUSUARIO', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'APPACUSUAREA', referencedColumnName: 'id' },
  })
  areas: _PrivSecPacAreaOrm[];
}
