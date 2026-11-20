import { BadRequestException } from '@nestjs/common';
import type { SettingsRecord, SlotConfig } from '../storage/types';
import { isDateISO, timeInZone, todayISO } from './time';

export function slotOf(settings: SettingsRecord, slotId?: string): SlotConfig {
  if (!slotId) return currentSlot(settings);
  const slot = settings.slots.find((s) => s.id === slotId);
  if (!slot) {
    throw new BadRequestException({
      code: 'INVALID_SLOT',
      message: `La franja "${slotId}" no existe.`,
    });
  }
  return slot;
}

export function currentSlot(settings: SettingsRecord): SlotConfig {
  const { hour, minute } = timeInZone();
  const now = hour * 60 + minute;
  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const active = settings.slots.find(
    (slot) => now >= toMinutes(slot.start) && now < toMinutes(slot.end),
  );
  if (active) return active;

  // Entre franjas (13–14 y después de las 22) se muestra la próxima del día.
  const next = settings.slots.find((slot) => toMinutes(slot.start) > now);
  return next ?? settings.slots[0];
}

export function resolveDate(date?: string): string {
  const value = date?.trim() || todayISO();
  if (!isDateISO(value)) {
    throw new BadRequestException({
      code: 'INVALID_DATE',
      message: 'La fecha debe tener formato YYYY-MM-DD.',
    });
  }
  return value;
}

export function assertBookableDate(
  date: string,
  settings: SettingsRecord,
  options: { allowPast?: boolean } = {},
): void {
  const today = todayISO();
  if (!options.allowPast && date < today) {
    throw new BadRequestException({
      code: 'DATE_IN_PAST',
      message: 'No se puede reservar en una fecha pasada.',
    });
  }
  const limit = new Date(`${today}T12:00:00-03:00`);
  limit.setUTCDate(limit.getUTCDate() + settings.maxAdvanceDays);
  const maxDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(limit);
  if (date > maxDate) {
    throw new BadRequestException({
      code: 'ADVANCE_LIMIT',
      message: `Solo se puede reservar hasta ${settings.maxAdvanceDays} días de anticipación.`,
    });
  }
}
