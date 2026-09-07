import { Check, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SocketUserOrm } from '@socket/common/orm';

@Entity('CHATCONTACTOPERMITIDO')
@Check('CK_CHATCONTACTOPERMITIDO_DISTINTOS', '"CHATUSUREG" <> "CONTACTO"')
export class ChatAccessContactOrm {
  @PrimaryColumn({ name: 'CHATUSUREG' })
  userId: number;

  @ManyToOne(() => SocketUserOrm)
  @JoinColumn({ name: 'CHATUSUREG' })
  user: SocketUserOrm;

  @PrimaryColumn({ name: 'CONTACTO' })
  contactUserId: number;

  @ManyToOne(() => SocketUserOrm)
  @JoinColumn({ name: 'CONTACTO' })
  contact: SocketUserOrm;
}
