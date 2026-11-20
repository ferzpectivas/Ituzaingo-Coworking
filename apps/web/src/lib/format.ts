export const STATUS_LABELS: Record<string, string> = {
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  no_show: 'Ausente',
};

export const STATUS_STYLES: Record<string, string> = {
  confirmada: 'bg-teal-soft text-teal',
  en_curso: 'bg-amber-soft text-amber',
  finalizada: 'bg-[#eef1ee] text-muted',
  cancelada: 'bg-rose-soft text-rose',
  no_show: 'bg-rose-soft text-rose',
};

export const ROLE_LABELS: Record<string, string> = {
  socio: 'Socio',
  administrador: 'Administrador',
  director: 'Director',
};

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
    ...options,
  }).format(new Date(`${date}T12:00:00-03:00`));
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(`${date}T12:00:00-03:00`));
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso));
}

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDaysISO(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00-03:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function currency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}
