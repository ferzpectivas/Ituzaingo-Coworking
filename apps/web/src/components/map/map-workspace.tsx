'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Laptop,
  RefreshCw,
  Users,
} from 'lucide-react';
import { API_URL, api, ApiError } from '@/lib/api';
import { addDaysISO, formatDateLong, percent, todayISO } from '@/lib/format';
import type { ConfigResponse, Floorplan, Occupancy, ReservationDetail } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { MapView } from '@/components/map/map-view';
import { ReservationWizard } from '@/components/reservations/reservation-wizard';
import { Metric, PageLoader, ProgressBar, SectionHeading, StatusBadge } from '@/components/ui/primitives';

export function MapWorkspace({ floorplan }: { floorplan: Floorplan }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [date, setDate] = useState(todayISO());
  const [slotId, setSlotId] = useState('manana');
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSpace, setWizardSpace] = useState<string | undefined>(undefined);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    api<ConfigResponse>('/config')
      .then((result) => {
        if (!active) return;
        setConfig(result);
        setDate(result.today);
        setSlotId(result.currentSlotId);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar la configuración.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadOccupancy = useCallback(async () => {
    try {
      const result = await api<Occupancy>(
        `/map/occupancy?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slotId)}`,
      );
      setOccupancy(result);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo actualizar la ocupación.');
    } finally {
      setLoading(false);
    }
  }, [date, slotId]);

  useEffect(() => {
    setLoading(true);
    void loadOccupancy();
  }, [loadOccupancy]);

  // Actualizaciones en tiempo real por SSE.
  useEffect(() => {
    if (!config) return;
    const source = new EventSource(
      `${API_URL}/stream/occupancy?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slotId)}`,
      { withCredentials: true },
    );
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    const onSnapshot = (event: MessageEvent) => {
      try {
        setOccupancy(JSON.parse(event.data) as Occupancy);
        setLoading(false);
      } catch {
        // Ignoramos payloads inválidos.
      }
    };
    source.addEventListener('snapshot', onSnapshot as EventListener);
    source.addEventListener('change', () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void loadOccupancy(), 400);
    });
    return () => {
      source.close();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [config, date, slotId, loadOccupancy]);

  const slots = config?.settings.slots ?? [];
  const maxDate = addDaysISO(config?.today ?? todayISO(), config?.settings.maxAdvanceDays ?? 45);
  const minDate = config?.today ?? todayISO();

  const pendingReservations = useMemo(
    () =>
      occupancy
        ? occupancy.spaces.flatMap((space) =>
            space.reservations.map((reservation) => ({ ...reservation, space })),
          )
        : [],
    [occupancy],
  );

  const occupancyRate = occupancy?.totals.capacity
    ? occupancy.totals.occupiedSeats / occupancy.totals.capacity
    : 0;

  function openWizard(spaceCode?: string) {
    setWizardSpace(spaceCode);
    setWizardOpen(true);
  }

  function shiftDate(days: number) {
    const next = addDaysISO(date, days);
    if (next < minDate || next > maxDate) return;
    setDate(next);
  }

  if (!config && loading) return <PageLoader label="Cargando el mapa" />;

  if (!config) {
    return (
      <div className="card p-6">
        <p className="text-sm text-rose">{error ?? 'No se pudo cargar el panel.'}</p>
        <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Mapa en vivo"
        title="Ocupación del espacio"
        description="Explorá la planta, consultá asientos libres y reservá la franja que necesitás."
        actions={
          <>
            <span
              className={`badge ${live ? 'bg-teal-soft text-teal' : 'bg-[#eef1ee] text-muted'}`}
              title={live ? 'Actualización en tiempo real activa' : 'Sin conexión en tiempo real'}
            >
              <CircleDot size={11} className={live ? 'animate-pulse' : ''} />
              {live ? 'En vivo' : 'Actualización manual'}
            </span>
            <button type="button" onClick={() => void loadOccupancy()} className="btn btn-outline btn-sm">
              <RefreshCw size={14} /> Actualizar
            </button>
          </>
        }
      />

      <div className="card flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            disabled={date <= minDate}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted transition hover:border-teal/40 hover:text-teal disabled:opacity-40"
            aria-label="Día anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <label htmlFor="map-date" className="sr-only">
            Fecha
          </label>
          <input
            id="map-date"
            type="date"
            className="input w-auto"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(event) => setDate(event.target.value)}
          />
          <button
            type="button"
            onClick={() => shiftDate(1)}
            disabled={date >= maxDate}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted transition hover:border-teal/40 hover:text-teal disabled:opacity-40"
            aria-label="Día siguiente"
          >
            <ChevronRight size={16} />
          </button>
          <span className="hidden text-sm text-muted sm:inline">
            {formatDateLong(date)}
            {date === config.today ? ' · hoy' : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-line bg-[#f7f8f6] p-0.5" role="group" aria-label="Franja horaria">
            {slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSlotId(slot.id)}
                aria-pressed={slotId === slot.id}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  slotId === slot.id ? 'bg-teal text-white shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {slot.start}–{slot.end}
              </button>
            ))}
          </div>
          {user && user.role !== 'director' ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openWizard(selectedSpace ?? undefined)}>
              Nueva reserva
              <ArrowRight size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose/25 bg-rose-soft px-3.5 py-2.5 text-sm text-rose">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Ocupación" value={percent(occupancyRate, 0)} hint={`${occupancy?.totals.occupiedSeats ?? 0} de ${occupancy?.totals.capacity ?? floorplan.totals.seats} puestos`} tone="teal" />
        <Metric label="Puestos libres" value={Math.max(0, (occupancy?.totals.capacity ?? 0) - (occupancy?.totals.occupiedSeats ?? 0))} hint="En la franja seleccionada" />
        <Metric label="Reservas" value={occupancy?.totals.reservations ?? 0} hint={`${occupancy?.totals.people ?? 0} personas registradas`} />
        <Metric
          label="Franja"
          value={occupancy?.slot.start ?? slots.find((slot) => slot.id === slotId)?.start ?? '—'}
          hint={occupancy ? `Hasta las ${occupancy.slot.end}` : 'Consultando'}
          tone="gold"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.75fr_1fr]">
        <div className="space-y-4">
          <MapView
            floorplan={floorplan}
            occupancy={occupancy}
            selectedSpace={selectedSpace}
            onSelectSpace={(code) => setSelectedSpace((current) => (current === code ? null : code))}
            height="h-[480px] sm:h-[560px]"
          />
          <p className="text-xs leading-relaxed text-muted">
            Los nombres de otras personas se muestran abreviados para socios. El equipo administrativo y
            la dirección ven el nombre completo. Tocá o hacé clic en un asiento para ver la reserva y sus
            acompañantes.
          </p>
        </div>

        <div className="space-y-3">
          {(occupancy?.spaces ?? []).map((space) => {
            const rate = space.capacity ? space.occupiedSeats / space.capacity : 0;
            const active = selectedSpace === space.code;
            return (
              <div
                key={space.code}
                className={`card p-4 transition ${active ? 'ring-2 ring-teal/25' : ''}`}
                style={{ borderLeftColor: space.color, borderLeftWidth: 4 }}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedSpace(active ? null : space.code)}
                  aria-pressed={active}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-serif text-lg leading-tight text-ink">{space.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {space.freeSeats} libres de {space.capacity} puestos
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        space.freeSeats === 0
                          ? 'bg-rose-soft text-rose'
                          : rate > 0.6
                            ? 'bg-amber-soft text-amber'
                            : 'bg-teal-soft text-teal'
                      }`}
                    >
                      {space.freeSeats === 0 ? 'Completo' : `${percent(rate, 0)} ocupado`}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar value={rate} tone={rate > 0.6 ? 'gold' : 'teal'} />
                  </div>
                </button>
                {user && user.role !== 'director' ? (
                  <button
                    type="button"
                    onClick={() => openWizard(space.code)}
                    disabled={space.freeSeats === 0}
                    className="btn btn-outline btn-sm mt-3 w-full"
                  >
                    {space.freeSeats === 0 ? 'Sin disponibilidad' : 'Reservar en este ambiente'}
                    {space.freeSeats > 0 ? <ArrowRight size={13} /> : null}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <p className="font-serif text-lg text-ink">Reservas de la franja</p>
            <p className="text-xs text-muted">
              {formatDateLong(date)} · {occupancy?.slot.label ?? ''}
            </p>
          </div>
          {user?.role === 'administrador' ? (
            <Link href="/panel/operaciones" className="btn btn-ghost btn-sm">
              Abrir operación diaria <ArrowRight size={13} />
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
        ) : pendingReservations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-ink">No hay reservas para esta franja.</p>
            <p className="mt-1 text-xs text-muted">
              {user?.role === 'director'
                ? 'La vista de dirección es sólo de consulta.'
                : 'Podés ser la primera persona en reservar.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {pendingReservations.map((reservation) => (
              <li key={reservation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold text-white"
                  style={{ background: reservation.space.color }}
                >
                  {reservation.space.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {reservation.holder.displayName}
                    {reservation.companionsCount > 0 ? (
                      <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[0.65rem] font-bold text-amber">
                        + {reservation.companionsCount}
                      </span>
                    ) : null}
                    {reservation.isMine ? (
                      <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[0.65rem] font-semibold text-teal">
                        Tu reserva
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    {reservation.space.name} · {reservation.furnitureCodes.join(', ')} ·{' '}
                    {reservation.peopleCount} {reservation.peopleCount === 1 ? 'persona' : 'personas'}
                    {reservation.equipment.computers
                      ? ` · ${reservation.equipment.computers} PC`
                      : ''}
                    {reservation.equipment.projectors
                      ? ` · ${reservation.equipment.projectors} proyector`
                      : ''}
                  </p>
                </div>
                <StatusBadge status={reservation.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Clock3 size={14} className="text-teal" /> Franjas de 4 horas
          </p>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
            {slots.map((slot) => `${slot.start}–${slot.end}`).join(' · ')}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Users size={14} className="text-teal" /> Titular y acompañantes
          </p>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
            Todas las personas se identifican con DNI. Los datos se almacenan cifrados.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Laptop size={14} className="text-teal" /> Equipamiento con checklist
          </p>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
            Computadoras con funda y cargador; proyectores con caja, HDMI, VGA y energía.
          </p>
        </div>
      </div>

      <ReservationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(_reservation: ReservationDetail) => {
          void loadOccupancy();
        }}
        config={config}
        defaultDate={date}
        defaultSlot={slotId}
        defaultSpace={wizardSpace}
        role={user?.role ?? 'socio'}
      />
    </div>
  );
}
