import type { CreateEventPayload, ValidatedCreateEvent } from '@socket/events/domain/types';

export function validateEventInput(payload: CreateEventPayload): ValidatedCreateEvent | string {
  const title = text(payload?.title);
  const description = text(payload?.description);
  const location = text(payload?.location);
  const organizerDescription = text(payload?.organizerDescription);
  const startsAt = date(payload?.startsAt);
  const endsAt = date(payload?.endsAt);

  if (!title) return 'El título del evento es obligatorio.';
  if (title.length > 160) return 'El título no puede superar 160 caracteres.';
  if (!description) return 'La descripción del evento es obligatoria.';
  if (description.length > 20_000) return 'La descripción es demasiado extensa.';
  if (!location) return 'El lugar del evento es obligatorio.';
  if (location.length > 250) return 'El lugar no puede superar 250 caracteres.';
  if (!organizerDescription) return 'La descripción pública del organizador es obligatoria.';
  if (organizerDescription.length > 200) {
    return 'El organizador no puede superar 200 caracteres.';
  }
  if (!startsAt || !endsAt) return 'El rango de fechas del evento no es válido.';
  if (endsAt <= startsAt) return 'La fecha final debe ser posterior a la fecha de inicio.';

  return { title, description, location, organizerDescription, startsAt, endsAt };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function date(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}
