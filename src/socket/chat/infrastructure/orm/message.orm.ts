import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatMessageAttachmentOrm } from './message-attachment.orm';
import { ChatUserOrm } from './user.orm';

@Entity('CHATMENSAJE', { schema: 'dbo' })
@Index('IX_CHATMENSAJE_CONVERSACION_OID', ['conversationId', 'id'])
@Index('IX_CHATMENSAJE_NOLEIDO_DEST_CONV_OID', ['recipientUserId', 'conversationId', 'id'], {
  where: 'FECELI IS NULL',
})
export class ChatMessageOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CHATCONVERSACION' })
  conversationId: number;

  @Column({ name: 'CHATUSUREG1' })
  senderUserId: number;

  @ManyToOne(() => ChatUserOrm)
  @JoinColumn({ name: 'CHATUSUREG1' })
  senderUser: ChatUserOrm;

  @Column({ name: 'CHATUSUREG2' })
  recipientUserId: number;

  @ManyToOne(() => ChatUserOrm)
  @JoinColumn({ name: 'CHATUSUREG2' })
  recipientUser: ChatUserOrm;

  @Column({ name: 'CONTENIDO', type: 'varbinary', length: 'max' })
  content: Buffer;

  @OneToMany(() => ChatMessageAttachmentOrm, attachment => attachment.message)
  attachments: ChatMessageAttachmentOrm[];

  @Column({ name: 'CHATMENRESPUESTA', nullable: true })
  @Index('IX_CHATMENSAJE_CHATMENRESPUESTA')
  replyToMessageId?: number | null;

  @ManyToOne(() => ChatMessageOrm, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'CHATMENRESPUESTA' })
  replyToMessage?: ChatMessageOrm | null;

  @Column({ name: 'FECMOD', nullable: true })
  editedAt?: Date | null;

  @Column({ name: 'FECELI', nullable: true })
  deletedAt?: Date | null;

  @Column({ name: 'FECCRE' })
  createdAt: Date;
}
