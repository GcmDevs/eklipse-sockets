import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChatMessageOrm } from './message.orm';

@Entity('CHATMENARCHIVO', { schema: 'dbo' })
@Index('IX_CHATMENARCHIVO_CHATMENSAJE', ['messageId'])
export class ChatMessageAttachmentOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CHATMENSAJE' })
  messageId: number;

  @ManyToOne(() => ChatMessageOrm, message => message.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'CHATMENSAJE' })
  message: ChatMessageOrm;

  @Column({ name: 'UBICACION', length: 500 })
  path: string;
}
