import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ADNCENATE')
export class _PrivSecEkCenterOrm {
  @PrimaryGeneratedColumn({ name: 'OID', type: 'tinyint' })
  id: number;

  @Column({ name: 'CODIGO', type: 'varchar', length: 10 })
  code: string;

  @Column({ name: 'NOMBRE', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'CONTEXTO', type: 'varchar', length: 10, nullable: true })
  context: string;

  @Column({ name: 'NIT', type: 'varchar', length: 20, nullable: true })
  nit: string;

  @Column({ name: 'ORIGINALID', type: 'tinyint', nullable: true })
  originalId: number;
}
