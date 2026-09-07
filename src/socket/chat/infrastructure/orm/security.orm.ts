import { SocketUserOrm } from '@socket/common/infrastructure/orm';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('CHATSEGURIDAD')
@Index('UQ_CHATSEGURIDAD_CHATUSUREG', ['userId'], { unique: true })
export class ChatSecurityOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CHATUSUREG' })
  userId: number;

  @ManyToOne(() => SocketUserOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'CHATUSUREG' })
  user: SocketUserOrm;

  @Column({ name: 'PINHASH', length: 100, nullable: true, select: false })
  pinHash: string | null;

  @Column({ name: 'FECCRE' })
  createdAt: Date;

  @Column({ name: 'FECACT' })
  updatedAt: Date;
}
