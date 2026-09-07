import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { SocketUserOrm } from '@socket/common/infrastructure/orm';

@Entity('CHATPOLITICA')
export class ChatAccessPolicyOrm {
  @PrimaryColumn({ name: 'CHATUSUREG' })
  userId: number;

  @OneToOne(() => SocketUserOrm)
  @JoinColumn({ name: 'CHATUSUREG' })
  user: SocketUserOrm;

  @Column({ name: 'RESTRINGEENTRADA', default: false })
  incomingRestricted: boolean;

  @Column({ name: 'CONTACTOSCERRADOS', default: false })
  contactsRestricted: boolean;

  @Column({ name: 'DESCUBRETODOS', default: false })
  discoverAll: boolean;
}
