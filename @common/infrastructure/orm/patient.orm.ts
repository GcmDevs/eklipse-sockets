import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('GENPACIEN')
export class _PrivSecPacOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'PACNUMDOC' })
  documento: string;

  @Column({ name: 'GPANOMCOM' })
  nombreCompleto: string;
}
