import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChatConversationOrm } from './conversation.orm';
import { ChatMessageOrm } from './message.orm';
import { ChatUserOrm } from './user.orm';

@Entity('CHATCONLECTURA', { schema: 'dbo' })
@Index('UQ_CHATCONLECTURA_USUARIO_CONVERSACION', ['userId', 'conversationId'], {
  unique: true,
})
export class ChatConversationReadOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'CHATCONVERSACION' })
  conversationId: number;

  @ManyToOne(() => ChatConversationOrm)
  @JoinColumn({ name: 'CHATCONVERSACION' })
  conversation: ChatConversationOrm;

  @Column({ name: 'CHATUSUREG' })
  userId: number;

  @ManyToOne(() => ChatUserOrm)
  @JoinColumn({ name: 'CHATUSUREG' })
  user: ChatUserOrm;

  @Column({ name: 'CHATMENSAJE', nullable: true })
  lastReadMessageId?: number | null;

  @ManyToOne(() => ChatMessageOrm, { nullable: true })
  @JoinColumn({ name: 'CHATMENSAJE' })
  lastReadMessage?: ChatMessageOrm | null;

  @Column({ name: 'FECACT' })
  updatedAt: Date;
}
