import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EVENT_ATTENDANCE_STATUSES, EventAttendanceStatusCode } from '@socket/events/domain/types';
import { EventOrm } from './event.orm';
import { TipoUsuarioCode } from '@common/domain/types';

@Entity('EVEINVITACION')
@Check('CK_EVEINVITACION_ESTADOCODE', '"ESTADOCODE" IN (1, 2, 3)')
@Index(
  'UQ_EVEINVITACION_EVENTO_USUARIO',
  ['eventId', 'inviteeUserId', 'centerId', 'typeUserCode'],
  { unique: true }
)
@Index('IX_EVEINVITACION_USUARIO_ESTADOCODE', [
  'inviteeUserId',
  'centerId',
  'typeUserCode',
  'status',
])
export class EventInvitationOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'EVEEVENTO' })
  eventId: number;

  @ManyToOne(() => EventOrm, event => event.invitations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'EVEEVENTO' })
  event: EventOrm;

  @Column({ name: 'USUINVITOID' })
  inviteeUserId: number;

  /** Este registro almacena el contexto original del usuario */
  @Column({ name: 'ADNCENATE', type: 'smallint' })
  centerId: number;

  /** Este registro almacena el contexto original del usuario */
  @Column({ name: 'TIPOUSUINV', type: 'smallint' })
  typeUserCode: TipoUsuarioCode;

  @Column({
    name: 'ESTADOCODE',
    type: 'smallint',
    default: EVENT_ATTENDANCE_STATUSES.PENDING.getCode(),
  })
  status: EventAttendanceStatusCode;

  @Column({ name: 'FECINV', type: 'timestamp' })
  invitedAt: Date;

  @Column({ name: 'FECRESP', type: 'timestamp', nullable: true })
  respondedAt?: Date | null;
}
