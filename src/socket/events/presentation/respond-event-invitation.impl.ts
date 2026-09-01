import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { SocketClientRegistry } from '@socket/common/client-registry';
import { PATIENTS_FRONTEND_CLIENT } from '@socket/common/constants';
import { SOCKET_EVENTS } from '@socket/common/events';
import type { SocketUser } from '@socket/common/types';
import type {
  EventActionAck,
  EventAttendanceStatusCode,
  NewEventInvitation,
  RespondEventInvitationPayload,
} from '@socket/events/domain/types';
import { EventStoreService } from '@socket/events/infrastructure/services';

@Injectable()
export class RespondEventInvitationImpl {
  private readonly logger = new Logger(RespondEventInvitationImpl.name);

  constructor(
    private readonly store: EventStoreService,
    private readonly clients: SocketClientRegistry
  ) {}

  async execute(
    client: Socket,
    payload: RespondEventInvitationPayload
  ): Promise<EventActionAck<NewEventInvitation>> {
    const currentUser = client.data.socketUser as SocketUser | undefined;
    if (!currentUser) return { ok: false, error: 'No fue posible identificar tu sesión.' };
    if (currentUser.role !== 'PACIENTE') {
      return { ok: false, error: 'Solo los pacientes pueden responder invitaciones.' };
    }
    if (currentUser.clientApp !== PATIENTS_FRONTEND_CLIENT) {
      return { ok: false, error: 'Este canal solo admite el frontend de pacientes.' };
    }

    const invitationId = Number(payload?.invitationId);
    if (!Number.isSafeInteger(invitationId) || invitationId <= 0) {
      return { ok: false, error: 'La invitación indicada no es válida.' };
    }
    if (payload?.status !== 2 && payload?.status !== 3) {
      return { ok: false, error: 'La respuesta de asistencia no es válida.' };
    }

    try {
      const invitation = await this.store.respondToInvitation(
        currentUser,
        invitationId,
        payload.status as EventAttendanceStatusCode
      );
      if (!invitation) {
        return { ok: false, error: 'La invitación no existe o no te pertenece.' };
      }

      this.clients.emitToMatchingAuthenticatedUsers(
        PATIENTS_FRONTEND_CLIENT,
        SOCKET_EVENTS.events.invitationUpdated,
        user =>
          user.role === 'PACIENTE' &&
          user.userId === currentUser.userId &&
          user.centerId === currentUser.centerId
            ? invitation
            : undefined
      );

      return { ok: true, data: invitation };
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.logger.error('Error al responder la invitación', trace);
      return { ok: false, error: 'No fue posible guardar tu respuesta.' };
    }
  }
}
