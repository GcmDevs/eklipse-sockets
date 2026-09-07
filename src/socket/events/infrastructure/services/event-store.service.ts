import { Injectable } from '@nestjs/common';
import { GcmContextCode, gcmContextFactory, TIPOS_USUARIO } from '@common/domain/types';
import { switchConn, switchSocketsConn } from '@common/infrastructure/services';
import type { SocketUser } from '@socket/common/types';
import {
  EVENT_ATTENDANCE_STATUSES,
  type EventAttendanceStatusCode,
  type NewEventInvitation,
  type PersistedEventCreation,
  type PersistedEventUpdate,
  type RegisteredEventData,
  type ValidatedCreateEvent,
} from '@socket/events/domain/types';
import { EventInvitationOrm, EventOrm } from '@socket/events/infrastructure/orm';
import { _PrivSecPacAsUserOrm } from '@common/infrastructure/orm/patient-as-user.orm';
import { _PrivSecPacAreaOrm } from '@common/infrastructure/orm/patient-area.orm';
import type { EventAudienceArea } from '@socket/events/domain/types';
import { In } from 'typeorm';

type RegisteredPatientIdentity = {
  userId: number;
  centerId: number;
};

@Injectable()
export class EventStoreService {
  private readonly INVITATION_INSERT_CHUNK_SIZE = 300;
  private readonly sharedConn = switchSocketsConn();

  async createEvent(
    user: SocketUser,
    input: ValidatedCreateEvent
  ): Promise<PersistedEventCreation> {
    const registeredPatients = await this.registeredPatients(user, input.inviteeUserIds);
    if (registeredPatients.length !== input.inviteeUserIds.length) {
      throw new Error('La selección contiene pacientes que no están registrados.');
    }

    return this.sharedConn.transaction(async manager => {
      const createdAt = new Date();
      const eventRepository = manager.getRepository(EventOrm);

      const event = await eventRepository.save(
        eventRepository.create({
          ...input,
          organizerUserId: user.userId,
          centerId: user.centerId,
          createdAt,
          updatedAt: createdAt,
        })
      );

      const invitationRepository = manager.getRepository(EventInvitationOrm);
      for (
        let offset = 0;
        offset < registeredPatients.length;
        offset += this.INVITATION_INSERT_CHUNK_SIZE
      ) {
        const chunk = registeredPatients.slice(offset, offset + this.INVITATION_INSERT_CHUNK_SIZE);
        await invitationRepository.insert(
          chunk.map(patient => ({
            eventId: event.id,
            inviteeUserId: patient.userId,
            centerId: patient.centerId,
            typeUserCode: TIPOS_USUARIO.PACIENTE.getCode(),
            status: EVENT_ATTENDANCE_STATUSES.PENDING.getCode(),
            invitedAt: createdAt,
            respondedAt: null,
          }))
        );
      }

      const invitations = await invitationRepository.find({
        where: { eventId: event.id },
        select: {
          id: true,
          inviteeUserId: true,
          centerId: true,
          status: true,
          invitedAt: true,
        },
      });

      return {
        event: {
          id: Number(event.id),
          title: event.title,
          description: event.description,
          location: event.location,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          organizerDescription: event.organizerDescription,
          createdAt: event.createdAt.toISOString(),
        },
        invitations: invitations.map(invitation => ({
          id: Number(invitation.id),
          inviteeUserId: Number(invitation.inviteeUserId),
          centerId: Number(invitation.centerId),
          status: invitation.status,
          invitedAt: invitation.invitedAt.toISOString(),
          respondedAt: invitation.respondedAt?.toISOString() ?? null,
        })),
        invitedUsersCount: invitations.length,
      };
    });
  }

  async eventAudience(user: SocketUser): Promise<EventAudienceArea[]> {
    const context = gcmContextFactory(user.context as GcmContextCode);
    const areas = await switchConn(context)
      .getRepository(_PrivSecPacAreaOrm)
      .find({
        relations: { pacientes: true },
        order: { nombre: 'ASC' },
      });

    return areas.map(area => ({
      id: Number(area.id),
      code: area.codigo,
      name: area.nombre,
      patients: (area.pacientes ?? [])
        .map(patient => ({
          userId: Number(patient.id),
          document: patient.document,
          fullName: patient.fullName,
        }))
        .sort((left, right) => left.fullName.localeCompare(right.fullName, 'es')),
    }));
  }

  async eventsCreatedBy(user: SocketUser): Promise<RegisteredEventData[]> {
    const events = await this.sharedConn.getRepository(EventOrm).find({
      where: {
        organizerUserId: user.userId,
        centerId: user.centerId,
      },
      relations: { invitations: true },
      order: { startsAt: 'DESC' },
    });

    return events.map(event => this.toRegisteredEventData(event));
  }

  async updateEvent(
    user: SocketUser,
    eventId: number,
    input: ValidatedCreateEvent
  ): Promise<PersistedEventUpdate | null> {
    return this.sharedConn.transaction(async manager => {
      const eventRepository = manager.getRepository(EventOrm);
      const event = await eventRepository.findOne({
        where: {
          id: eventId,
          organizerUserId: user.userId,
          centerId: user.centerId,
        },
        relations: { invitations: true },
      });
      if (!event) return null;

      event.title = input.title;
      event.description = input.description;
      event.location = input.location;
      event.startsAt = input.startsAt;
      event.endsAt = input.endsAt;
      event.organizerDescription = input.organizerDescription;
      event.updatedAt = new Date();
      await eventRepository.save(event);

      return {
        event: this.toRegisteredEventData(event),
        invitations: event.invitations.map(invitation => ({
          id: Number(invitation.id),
          inviteeUserId: Number(invitation.inviteeUserId),
          centerId: Number(invitation.centerId),
          status: invitation.status,
          invitedAt: invitation.invitedAt.toISOString(),
          respondedAt: invitation.respondedAt?.toISOString() ?? null,
        })),
      };
    });
  }

  async invitationsForPatient(user: SocketUser): Promise<NewEventInvitation[]> {
    const invitations = await this.sharedConn.getRepository(EventInvitationOrm).find({
      where: {
        inviteeUserId: user.userId,
        centerId: user.centerId,
        typeUserCode: TIPOS_USUARIO.PACIENTE.getCode(),
      },
      relations: { event: true },
      order: { invitedAt: 'DESC' },
    });

    return invitations.map(invitation => this.toInvitationData(invitation));
  }

  async respondToInvitation(
    user: SocketUser,
    invitationId: number,
    status: EventAttendanceStatusCode
  ): Promise<NewEventInvitation | null> {
    const invitationRepository = this.sharedConn.getRepository(EventInvitationOrm);
    const invitation = await invitationRepository.findOne({
      where: {
        id: invitationId,
        inviteeUserId: user.userId,
        centerId: user.centerId,
        typeUserCode: TIPOS_USUARIO.PACIENTE.getCode(),
      },
      relations: { event: true },
    });
    if (!invitation) return null;

    invitation.status = status;
    invitation.respondedAt = new Date();
    await invitationRepository.save(invitation);

    return this.toInvitationData(invitation);
  }

  private async registeredPatients(
    user: SocketUser,
    inviteeUserIds: number[]
  ): Promise<RegisteredPatientIdentity[]> {
    const context = gcmContextFactory(user.context as GcmContextCode);
    const patients = await switchConn(context)
      .getRepository(_PrivSecPacAsUserOrm)
      .find({
        where: { id: In(inviteeUserIds) },
        select: { id: true },
      });

    return patients.map(patient => ({
      userId: Number(patient.id),
      centerId: user.centerId,
    }));
  }

  private toInvitationData(invitation: EventInvitationOrm): NewEventInvitation {
    const event = invitation.event;
    if (!event) throw new Error('La invitación no tiene un evento asociado.');

    return {
      id: Number(event.id),
      invitationId: Number(invitation.id),
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      organizerDescription: event.organizerDescription,
      createdAt: event.createdAt.toISOString(),
      status: invitation.status,
      invitedAt: invitation.invitedAt.toISOString(),
      respondedAt: invitation.respondedAt?.toISOString() ?? null,
    };
  }

  private toRegisteredEventData(event: EventOrm): RegisteredEventData {
    const invitations = event.invitations ?? [];

    return {
      id: Number(event.id),
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      organizerDescription: event.organizerDescription,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      invitedUsersCount: invitations.length,
      pendingUsersCount: invitations.filter(
        invitation => invitation.status === EVENT_ATTENDANCE_STATUSES.PENDING.getCode()
      ).length,
      attendingUsersCount: invitations.filter(
        invitation => invitation.status === EVENT_ATTENDANCE_STATUSES.ATTENDING.getCode()
      ).length,
      notAttendingUsersCount: invitations.filter(
        invitation => invitation.status === EVENT_ATTENDANCE_STATUSES.NOT_ATTENDING.getCode()
      ).length,
    };
  }
}
