import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { SocketClientRegistry } from '@socket/common/client-registry';
import { PATIENTS_FRONTEND_CLIENT } from '@socket/common/constants';
import { SOCKET_EVENTS } from '@socket/common/events';
import type { SocketUser } from '@socket/common/types';
import type {
  EventActionAck,
  UpdateEventPayload,
  UpdatedEventData,
} from '@socket/events/domain/types';
import { EventStoreService } from '@socket/events/infrastructure/services';
import { validateEventInput } from './event-input.validator';

@Injectable()
export class UpdateEventImpl {
  private readonly logger = new Logger(UpdateEventImpl.name);

  constructor(
    private readonly store: EventStoreService,
    private readonly clients: SocketClientRegistry
  ) {}

  async execute(
    client: Socket,
    payload: UpdateEventPayload
  ): Promise<EventActionAck<UpdatedEventData>> {
    const currentUser = client.data.socketUser as SocketUser | undefined;
    if (!currentUser) return { ok: false, error: 'No fue posible identificar tu sesión.' };
    if (currentUser.role !== 'USUARIO') {
      return { ok: false, error: 'Solo los usuarios internos pueden modificar eventos.' };
    }
    if (currentUser.clientApp !== PATIENTS_FRONTEND_CLIENT) {
      return { ok: false, error: 'Este canal solo admite el frontend de pacientes.' };
    }

    const eventId = Number(payload?.eventId);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
      return { ok: false, error: 'El evento indicado no es válido.' };
    }

    const validation = validateEventInput(payload);
    if (typeof validation === 'string') return { ok: false, error: validation };

    try {
      const update = await this.store.updateEvent(currentUser, eventId, validation);
      if (!update) return { ok: false, error: 'El evento no existe o no te pertenece.' };

      const invitationsByPatient = new Map(
        update.invitations.map(invitation => [
          `${invitation.centerId}:${invitation.inviteeUserId}`,
          {
            ...update.event,
            invitationId: invitation.id,
            status: invitation.status,
            invitedAt: invitation.invitedAt,
            respondedAt: invitation.respondedAt,
          },
        ])
      );
      const connectedUsersCount = this.clients.emitToMatchingAuthenticatedUsers(
        PATIENTS_FRONTEND_CLIENT,
        SOCKET_EVENTS.events.invitationUpdated,
        user => {
          if (user.role !== 'PACIENTE') return undefined;
          return invitationsByPatient.get(`${user.centerId}:${user.userId}`);
        }
      );

      return {
        ok: true,
        data: { ...update.event, connectedUsersCount },
      };
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.logger.error('Error al modificar el evento', trace);
      return { ok: false, error: 'No fue posible modificar el evento.' };
    }
  }
}
