import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { GcmContextCode } from '@common/domain/types';

@Entity('CHATLASTUSERBYCTX')
export class LastUserRegisteredByContextOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'LASTOID' })
  lastId: number;

  @Column({ name: 'CONTEXT' })
  context: GcmContextCode;
}
