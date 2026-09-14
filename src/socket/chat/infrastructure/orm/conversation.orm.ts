import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SocketUserOrm } from '@socket/common/infrastructure/orm';
import { ChatMessageOrm } from './message.orm';

@Entity('CHATCONVERSACION')
@Index('IX_CHATCONVERSACION_USUARIO1_ULTMOV', ['firstUserId', 'updatedAt'])
@Index('IX_CHATCONVERSACION_USUARIO2_ULTMOV', ['secondUserId', 'updatedAt'])
export class ChatConversationOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CHATUSUREG1' })
  firstUserId: number;

  @ManyToOne(() => SocketUserOrm)
  @JoinColumn({ name: 'CHATUSUREG1' })
  firstUser: SocketUserOrm;

  @Column({ name: 'CHATUSUREG2' })
  secondUserId: number;

  @ManyToOne(() => SocketUserOrm)
  @JoinColumn({ name: 'CHATUSUREG2' })
  secondUser: SocketUserOrm;

  @Column({ name: 'ENTIDADID', type: 'integer', nullable: true })
  entityId?: number | null;

  @Column({ name: 'ENTIDADCODIGO', type: 'varchar', length: 100, nullable: true })
  entityCode?: string | null;

  @Column({ name: 'TIPOENTIDAD', type: 'smallint', nullable: true })
  entityType?: number | null;

  @Column({ name: 'CONTEXTO', type: 'varchar', length: 10, nullable: true })
  context?: string | null;

  @Column({ name: 'CHATMENSAJE', nullable: true })
  lastMessageId?: number | null;

  @ManyToOne(() => ChatMessageOrm, { nullable: true })
  @JoinColumn({ name: 'CHATMENSAJE' })
  lastMessage: ChatMessageOrm;

  @Column({ name: 'CHATUSUREG3', nullable: true })
  lastSenderUserId?: number | null;

  @ManyToOne(() => SocketUserOrm, { nullable: true })
  @JoinColumn({ name: 'CHATUSUREG3' })
  lastSenderUser: SocketUserOrm;

  @Column({ name: 'FECCRE' })
  createdAt: Date;

  @Column({ name: 'FECULTMOV' })
  updatedAt: Date;
}
