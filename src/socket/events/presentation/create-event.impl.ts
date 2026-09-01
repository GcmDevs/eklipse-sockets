import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { SocketClientRegistry } from '@socket/common/client-registry';
import { PATIENTS_FRONTEND_CLIENT } from '@socket/common/constants';
import { SOCKET_EVENTS } from '@socket/common/events';
import type { SocketUser } from '@socket/common/types';
import {
  type CreatedEventData,
  type CreateEventPayload,
  type EventActionAck,
} from '@socket/events/domain/types';
import { EventStoreService } from '@socket/events/infrastructure/services';
import { validateEventInput } from './event-input.validator';

@Injectable()
export class CreateEventImpl {
  private readonly logger = new Logger(CreateEventImpl.name);

  constructor(
    private readonly store: EventStoreService,
    private readonly clients: SocketClientRegistry
  ) {}

  async execute(
    client: Socket,
    payload: CreateEventPayload
  ): Promise<EventActionAck<CreatedEventData>> {
    const currentUser = client.data.socketUser as SocketUser | undefined;
    if (!currentUser) return { ok: false, error: 'No fue posible identificar tu sesión.' };
    if (currentUser.role !== 'USUARIO') {
      return { ok: false, error: 'Solo los usuarios internos pueden crear eventos.' };
    }
    if (currentUser.clientApp !== PATIENTS_FRONTEND_CLIENT) {
      return { ok: false, error: 'Este canal solo admite eventos del frontend de pacientes.' };
    }

    const validation = validateEventInput(payload);
    if (typeof validation === 'string') return { ok: false, error: validation };

    try {
      const creation = await this.store.createEvent(currentUser, validation);
      const invitationsByPatient = new Map(
        creation.invitations.map(invitation => [
          `${invitation.centerId}:${invitation.inviteeUserId}`,
          {
            ...creation.event,
            invitationId: invitation.id,
            status: invitation.status,
            invitedAt: invitation.invitedAt,
            respondedAt: invitation.respondedAt,
          },
        ])
      );
      const connectedUsersCount = this.clients.emitToMatchingAuthenticatedUsers(
        PATIENTS_FRONTEND_CLIENT,
        SOCKET_EVENTS.events.invitationCreated,
        user => {
          if (user.role !== 'PACIENTE') return undefined;
          return invitationsByPatient.get(`${user.centerId}:${user.userId}`);
        }
      );

      return {
        ok: true,
        data: {
          ...creation.event,
          connectedUsersCount,
          invitedUsersCount: creation.invitedUsersCount,
        },
      };
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.logger.error('Error al crear y propagar el evento', trace);
      return {
        ok: false,
        error: 'No fue posible guardar el evento. Intenta nuevamente.',
      };
    }
  }
}
