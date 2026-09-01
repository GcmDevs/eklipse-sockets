import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('GENPACIEN')
export class _PrivSecPatientOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'PACNUMDOC' })
  document: string;

  @Column({ name: 'GPANOMCOM' })
  fullName: string;
}
