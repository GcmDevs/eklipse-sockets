import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { PATIENTS_FRONTEND_CLIENT } from '@socket/common/constants';
import type { SocketUser } from '@socket/common/types';
import type { EventActionAck, RegisteredEventData } from '@socket/events/domain/types';
import { EventStoreService } from '@socket/events/infrastructure/services';

@Injectable()
export class ListCreatedEventsImpl {
  private readonly logger = new Logger(ListCreatedEventsImpl.name);

  constructor(private readonly store: EventStoreService) {}

  async execute(client: Socket): Promise<EventActionAck<RegisteredEventData[]>> {
    const currentUser = client.data.socketUser as SocketUser | undefined;
    if (!currentUser) return { ok: false, error: 'No fue posible identificar tu sesión.' };
    if (currentUser.role !== 'USUARIO') {
      return { ok: false, error: 'Solo los usuarios internos pueden consultar sus eventos.' };
    }
    if (currentUser.clientApp !== PATIENTS_FRONTEND_CLIENT) {
      return { ok: false, error: 'Este canal solo admite el frontend de pacientes.' };
    }

    try {
      return { ok: true, data: await this.store.eventsCreatedBy(currentUser) };
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.logger.error('Error al consultar los eventos del usuario', trace);
      return { ok: false, error: 'No fue posible consultar tus eventos.' };
    }
  }
}
