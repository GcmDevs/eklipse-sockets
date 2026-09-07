import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SocketUserOrm } from '@socket/common/orm';

@Entity('CHATENLACE')
@Check('CK_CHATENLACE_ORDEN', '"CHATUSUREG1" < "CHATUSUREG2"')
export class ChatAccessLinkOrm {
  @PrimaryColumn({ name: 'CHATUSUREG1' })
  firstUserId: number;

  @ManyToOne(() => SocketUserOrm)
  @JoinColumn({ name: 'CHATUSUREG1' })
  firstUser: SocketUserOrm;

  @PrimaryColumn({ name: 'CHATUSUREG2' })
  secondUserId: number;

  @ManyToOne(() => SocketUserOrm)
  @JoinColumn({ name: 'CHATUSUREG2' })
  secondUser: SocketUserOrm;

  @Column({ name: 'FECCRE' })
  createdAt: Date;
}
