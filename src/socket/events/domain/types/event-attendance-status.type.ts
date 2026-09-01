import { CtmType } from '@common/domain/types';

export type EventAttendanceStatusCode = 1 | 2 | 3;

export class EventAttendanceStatusType extends CtmType<EventAttendanceStatusCode> {}

const PENDING = new EventAttendanceStatusType(1, 'Pendiente');
const ATTENDING = new EventAttendanceStatusType(2, 'Asistirá');
const NOT_ATTENDING = new EventAttendanceStatusType(3, 'No asistirá');

export function eventAttendanceStatusFactory(
  code: EventAttendanceStatusCode
): EventAttendanceStatusType {
  switch (code) {
    case 1:
      return PENDING;
    case 2:
      return ATTENDING;
    case 3:
      return NOT_ATTENDING;
    default:
      throw new Error('No existe estado de asistencia con este código');
  }
}

export const EVENT_ATTENDANCE_STATUSES = { PENDING, ATTENDING, NOT_ATTENDING };

export const EVENT_ATTENDANCE_STATUSES_VALUES = Object.values(EVENT_ATTENDANCE_STATUSES);
