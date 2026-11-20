'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, CalendarPlus, Clock3, Laptop, MapPin, Search, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateLong, todayISO } from '@/lib/format';
import type { Paginated, ReservationDetail } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { ReservationDetailModal } from '@/components/reservations/reservation-detail';
import {
  EmptyState,
  Metric,
  PageLoader,
  SectionHeading,
  StatusBadge,
  Tabs,
} from '@/components/ui/primitives';

export default function MisReservasPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReservationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'proximas' | 'historial'>('proximas');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<Paginated<ReservationDetail>>('/reservations?limit=200');
      setItems(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar tus reservas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayISO();
  const upcoming = useMemo(
    () =>
      items
        .filter((item) => item.date >= today && item.status !== 'cancelada' && item.status !== 'finalizada' && item.status !== 'no_show')
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [items, today],
  );
  const history = useMemo(
    () =>
      items
        .filter((item) => !(item.date >= today && item.status !== 'cancelada' && item.status !== 'finalizada' && item.status !== 'no_show'))
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [items, today],
  );

  const source = tab === 'proximas' ? upcoming : history;
  const filtered = source.filter((item) => {
    if (!query.trim()) return true;
    const haystack = `${item.code} ${item.space.name} ${item.date} ${item.holder.displayName}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  if (!user) return null;
  if (loading) return <PageLoader label="Cargando tus reservas" />;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Mis reservas"
        title={`Hola, ${user.person.firstName}`}
        description="Consultá tus próximas reservas, descargá el evento o cancelá con anticipación."
        actions={
          <Link href="/panel/mapa" className="btn btn-primary btn-sm">
            <CalendarPlus size={15} /> Nueva reserva
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Próximas reservas" value={upcoming.length} hint="Confirmadas o en curso" tone="teal" />
        <Metric
          label="Personas en tus reservas"
          value={upcoming.reduce((acc, item) => acc + item.partySize, 0)}
          hint="Incluye titulares y acompañantes"
        />
        <Metric
          label="Equipos solicitados"
          value={upcoming.reduce((acc, item) => acc + item.equipment.length, 0)}
          hint="Pendientes de entrega o en uso"
          tone="gold"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          label="Filtrar reservas"
          value={tab}
          onChange={(value) => setTab(value as 'proximas' | 'historial')}
          items={[
            { value: 'proximas', label: 'Próximas', count: upcoming.length },
            { value: 'historial', label: 'Historial', count: history.length },
          ]}
        />
        <div className="relative w-full sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Buscar por código o espacio"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar reservas"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose/25 bg-rose-soft px-3.5 py-2.5 text-sm text-rose">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={tab === 'proximas' ? 'No tenés reservas próximas' : 'Todavía no hay historial'}
          description={
            tab === 'proximas'
              ? 'Reservá un puesto desde el mapa y aparecerá acá con su código.'
              : 'Las reservas finalizadas, canceladas o ausentes se muestran en esta pestaña.'
          }
          icon={<CalendarDays size={28} />}
          action={
            tab === 'proximas' ? (
              <Link href="/panel/mapa" className="btn btn-primary btn-sm">
                Ir al mapa <ArrowRight size={14} />
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {filtered.map((item) => (
            <li key={item.id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-serif text-base font-semibold"
                    style={{ background: `${item.space.color}18`, color: item.space.color }}
                  >
                    {item.space.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="font-serif text-lg leading-tight text-ink">{item.code}</p>
                    <p className="text-xs text-muted">{item.space.name}</p>
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="grid gap-2 px-4 py-3 text-sm">
                <p className="flex items-center gap-2 text-ink">
                  <CalendarDays size={14} className="text-muted" />
                  {formatDateLong(item.date)}
                  <span className="text-muted">· {item.slot.label}</span>
                </p>
                <p className="flex items-center gap-2 text-muted">
                  <Users size={14} /> {item.partySize} {item.partySize === 1 ? 'persona' : 'personas'}
                  {item.companionsCount > 0 ? ` · + ${item.companionsCount} acompañantes` : ''}
                </p>
                <p className="flex items-center gap-2 text-muted">
                  <MapPin size={14} />
                  {item.seats.map((seat) => seat.furnitureLabel).filter(Boolean).join(' · ') || 'Asignación automática'}
                </p>
                {item.equipment.length ? (
                  <p className="flex items-center gap-2 text-muted">
                    <Laptop size={14} />
                    {item.equipment.map((equipment) => equipment.assetTag).join(' · ')}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line bg-[#fbfcfa] px-4 py-2.5">
                <span className="inline-flex items-center gap-1 text-[0.68rem] text-muted">
                  <Clock3 size={12} /> Reservada {formatDate(item.createdAt.slice(0, 10))}
                </span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(item.id)}>
                  Ver detalle
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReservationDetailModal
        reservationId={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </div>
  );
}
