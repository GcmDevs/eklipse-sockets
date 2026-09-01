import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('CHATUSUREG', { schema: 'dbo' })
@Index('UQ_CHATUSUREG_USUDOCUME', ['document'], { unique: true })
export class ChatUserOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'USUDOCUME' })
  document: string;

  @Column({ name: 'USUDESCRI' })
  fullName: string;
}
