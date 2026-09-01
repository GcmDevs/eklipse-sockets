import { Check, Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EventInvitationOrm } from './event-invitation.orm';

@Entity('EVEEVENTO', { schema: 'dbo' })
@Check('CK_EVEEVENTO_RANGO_FECHAS', '[FECFIN] > [FECINICIO]')
@Index('IX_EVEEVENTO_ORGANIZADOR_INICIO', ['organizerUserId', 'startsAt'])
@Index('IX_EVEEVENTO_RANGO_FECHAS', ['startsAt', 'endsAt'])
export class EventOrm {
  @PrimaryGeneratedColumn({ name: 'OID' })
  id: number;

  @Column({ name: 'TITULO', type: 'varchar', length: 160 })
  title: string;

  @Column({ name: 'DESCRIPCION', type: 'varchar', length: 'max' })
  description: string;

  @Column({ name: 'LUGAR', type: 'varchar', length: 250 })
  location: string;

  @Column({ name: 'FECINICIO', type: 'datetime' })
  startsAt: Date;

  @Column({ name: 'FECFIN', type: 'datetime' })
  endsAt: Date;

  /** Descripción pública de la persona o entidad que organiza el evento. */
  @Column({ name: 'ORGANIDESCRI', type: 'varchar', length: 200 })
  organizerDescription: string;

  /** Identificador privado del usuario autenticado propietario del evento. */
  @Column({ name: 'ORGANIOID', type: 'int' })
  organizerUserId: number;

  /** Este registro almacena el contexto original del usuario */
  @Column({ name: 'ADNCENATE', type: 'tinyint' })
  centerId: number;

  @OneToMany(() => EventInvitationOrm, invitation => invitation.event)
  invitations: EventInvitationOrm[];

  @Column({ name: 'FECCRE', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'FECACT', type: 'datetime' })
  updatedAt: Date;
}
