import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChatUserOrm } from './user.orm';
import { ChatMessageOrm } from './message.orm';

@Entity('CHATCONVERSACION')
@Index('UQ_CHATCONVERSACION_PARTICIPANTES', ['firstUserId', 'secondUserId'], { unique: true })
@Index('IX_CHATCONVERSACION_USUARIO1_ULTMOV', ['firstUserId', 'updatedAt'])
@Index('IX_CHATCONVERSACION_USUARIO2_ULTMOV', ['secondUserId', 'updatedAt'])
export class ChatConversationOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CHATUSUREG1' })
  firstUserId: number;

  @ManyToOne(() => ChatUserOrm)
  @JoinColumn({ name: 'CHATUSUREG1' })
  firstUser: ChatUserOrm;

  @Column({ name: 'CHATUSUREG2' })
  secondUserId: number;

  @ManyToOne(() => ChatUserOrm)
  @JoinColumn({ name: 'CHATUSUREG2' })
  secondUser: ChatUserOrm;

  @Column({ name: 'CHATMENSAJE', nullable: true })
  lastMessageId?: number | null;

  @ManyToOne(() => ChatMessageOrm, { nullable: true })
  @JoinColumn({ name: 'CHATMENSAJE' })
  lastMessage: ChatMessageOrm;

  @Column({ name: 'CHATUSUREG3', nullable: true })
  lastSenderUserId?: number | null;

  @ManyToOne(() => ChatUserOrm, { nullable: true })
  @JoinColumn({ name: 'CHATUSUREG3' })
  lastSenderUser: ChatUserOrm;

  @Column({ name: 'FECCRE' })
  createdAt: Date;

  @Column({ name: 'FECULTMOV' })
  updatedAt: Date;
}
