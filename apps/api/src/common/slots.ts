import { BadRequestException } from '@nestjs/common';
import type { SettingsRecord, SlotConfig } from '../storage/types';
import { addDays, isDateISO, timeInZone, todayISO, weekday } from './time';

export const DEFAULT_OPENING_DAYS = [1, 2, 3, 4, 5];

export function defaultSlots(): SlotConfig[] {
  return [
    { id: 'manana', label: '08:00 a 11:00', start: '08:00', end: '11:00' },
    { id: 'mediodia', label: '11:00 a 15:00', start: '11:00', end: '15:00' },
    { id: 'tarde', label: '15:00 a 18:00', start: '15:00', end: '18:00' },
  ];
}

export function isOpenDate(date: string, settings: SettingsRecord): boolean {
  const days = settings.openingDays?.length ? settings.openingDays : DEFAULT_OPENING_DAYS;
  return days.includes(weekday(date));
}

export function assertOpenDate(date: string, settings: SettingsRecord): void {
  if (isOpenDate(date, settings)) return;
  throw new BadRequestException({
    code: 'DATE_CLOSED',
    message: 'El espacio está cerrado los fines de semana. Elegí un día de lunes a viernes.',
  });
}

export function nextOpenDate(date: string, settings: SettingsRecord): string {
  let current = date;
  for (let i = 0; i < 14; i += 1) {
    if (isOpenDate(current, settings)) return current;
    current = addDays(current, 1);
  }
  return date;
}

export function countOpenDays(from: string, to: string, settings: SettingsRecord): number {
  if (from > to) return 0;
  let count = 0;
  for (let current = from; current <= to; current = addDays(current, 1)) {
    if (isOpenDate(current, settings)) count += 1;
  }
  return count;
}

export function slotLabel(
  settings: SettingsRecord,
  slotId: string,
  startsAt?: string,
  endsAt?: string,
): string {
  const slot = settings.slots.find((s) => s.id === slotId);
  if (slot) return slot.label;
  if (!startsAt || !endsAt) return slotId;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatter.format(new Date(startsAt))} a ${formatter.format(new Date(endsAt))}`;
}

export function normalizeSettings(settings: SettingsRecord): boolean {
  const expectedSlots = defaultSlots();
  const slotsMatch =
    Array.isArray(settings.slots) &&
    settings.slots.length === expectedSlots.length &&
    expectedSlots.every((expected, index) => {
      const actual = settings.slots[index];
      return (
        actual?.id === expected.id &&
        actual?.label === expected.label &&
        actual?.start === expected.start &&
        actual?.end === expected.end
      );
    });
  const expectedDays = [...DEFAULT_OPENING_DAYS];
  const daysMatch =
    Array.isArray(settings.openingDays) &&
    settings.openingDays.length === expectedDays.length &&
    expectedDays.every((day) => settings.openingDays.includes(day));
  if (slotsMatch && daysMatch) return false;
  settings.slots = expectedSlots;
  settings.openingDays = expectedDays;
  return true;
}

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

  // Fuera de horario se muestra la próxima franja del día o la primera de la
  // jornada siguiente.
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
  assertOpenDate(date, settings);
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
