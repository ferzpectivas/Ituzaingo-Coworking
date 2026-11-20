import { appConfig } from '../config';

export const SLOT_DURATION_HOURS = 4;

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: appConfig.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function dateInZone(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: appConfig.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function timeInZone(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: appConfig.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour, minute };
}

export function isoFor(date: string, time: string): string {
  return `${date}T${time}:00-03:00`;
}

export function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00-03:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return dateInZone(base);
}

export function weekday(date: string): number {
  // 0 = domingo, 1 = lunes ... 6 = sábado
  return new Date(`${date}T12:00:00-03:00`).getUTCDay();
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function isDateISO(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: appConfig.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00-03:00`));
}

export function weekdayName(index: number): string {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][index] ?? '';
}
