import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChatUserOrm } from './user.orm';

@Entity('CHATSEGURIDAD')
@Index('UQ_CHATSEGURIDAD_CHATUSUREG', ['userId'], { unique: true })
export class ChatSecurityOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CHATUSUREG' })
  userId: number;

  @ManyToOne(() => ChatUserOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'CHATUSUREG' })
  user: ChatUserOrm;

  @Column({ name: 'PINHASH', length: 100, nullable: true, select: false })
  pinHash: string | null;

  @Column({ name: 'FECCRE' })
  createdAt: Date;

  @Column({ name: 'FECACT' })
  updatedAt: Date;
}
