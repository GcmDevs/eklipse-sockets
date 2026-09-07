import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { _PrivSecPacAsUserOrm } from './patient-as-user.orm';

@Entity('APPACUSUAREA')
export class _PrivSecPacAreaOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CODIGO' })
  codigo: string;

  @Column({ name: 'NOMBRE' })
  nombre: string;

  @ManyToMany(() => _PrivSecPacAsUserOrm, paciente => paciente.areas)
  pacientes: _PrivSecPacAsUserOrm[];
}
