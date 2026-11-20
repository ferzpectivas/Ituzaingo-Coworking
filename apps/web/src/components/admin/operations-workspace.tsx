'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Laptop,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDateLong, percent, todayISO } from '@/lib/format';
import type {
  ConfigResponse,
  Floorplan,
  Occupancy,
  Paginated,
  ReservationDetail,
  ReservationEquipment,
} from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { MapView } from '@/components/map/map-view';
import { ReservationDetailModal } from '@/components/reservations/reservation-detail';
import { ReservationWizard } from '@/components/reservations/reservation-wizard';
import {
  Metric,
  PageLoader,
  SectionHeading,
  StatusBadge,
} from '@/components/ui/primitives';

const STATUS_FILTERS = [
  { value: '', label: 'Todos los estados' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'finalizada', label: 'Finalizadas' },
  { value: 'cancelada', label: 'Canceladas' },
  { value: 'no_show', label: 'Ausentes' },
];

function pendingEquipment(item: ReservationDetail): ReservationEquipment[] {
  return item.equipment.filter((equipment) => equipment.status === 'reservada' || equipment.status === 'entregada');
}

export function OperationsWorkspace({ floorplan }: { floorplan: Floorplan }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [date, setDate] = useState(todayISO());
  const [slotId, setSlotId] = useState('manana');
  const [space, setSpace] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ReservationDetail[]>([]);
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<ConfigResponse>('/config')
      .then((result) => {
        setConfig(result);
        setDate(result.today);
        setSlotId(result.currentSlotId);
      })
      .catch(() => setError('No se pudo cargar la configuración del espacio.'));
  }, []);

  const loadOccupancy = useCallback(async () => {
    try {
      const result = await api<Occupancy>(
        `/map/occupancy?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slotId)}`,
      );
      setOccupancy(result);
    } catch {
      // La tabla sigue funcionando aunque falle el mapa.
    }
  }, [date, slotId]);

  const loadTable = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('from', date);
      params.set('to', date);
      params.set('limit', '200');
      if (space) params.set('space', space);
      if (status) params.set('status', status);
      if (query.trim()) params.set('q', query.trim());
      const result = await api<Paginated<ReservationDetail>>(`/reservations?${params.toString()}`);
      setItems(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar las reservas.');
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  }, [date, space, status, query]);

  useEffect(() => {
    void loadOccupancy();
  }, [loadOccupancy]);

  useEffect(() => {
    const timer = setTimeout(() => void loadTable(), 250);
    return () => clearTimeout(timer);
  }, [loadTable]);

  // Refresco periódico suave de la operación.
  useEffect(() => {
    const timer = setInterval(() => {
      void loadTable();
      void loadOccupancy();
    }, 60_000);
    return () => clearInterval(timer);
  }, [loadTable, loadOccupancy]);

  async function action(id: string, kind: 'check-in' | 'check-out' | 'no-show') {
    setBusy(`${id}:${kind}`);
    try {
      await api(`/reservations/${id}/${kind}`, { method: 'POST' });
      notify(
        kind === 'check-in'
          ? 'Ingreso registrado.'
          : kind === 'check-out'
            ? 'Reserva finalizada.'
            : 'Reserva marcada como ausente.',
        'success',
      );
      await Promise.all([loadTable(), loadOccupancy()]);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No se pudo completar la acción.', 'error');
    } finally {
      setBusy(null);
    }
  }

  const stats = useMemo(() => {
    const active = items.filter((item) => item.status !== 'cancelada' && item.status !== 'no_show');
    return {
      total: items.length,
      people: active.reduce((acc, item) => acc + item.partySize, 0),
      inProgress: items.filter((item) => item.status === 'en_curso').length,
      pending: items.reduce((acc, item) => acc + pendingEquipment(item).length, 0),
    };
  }, [items]);

  const occupancyRate = occupancy?.totals.capacity
    ? occupancy.totals.occupiedSeats / occupancy.totals.capacity
    : 0;

  if (loading && !config) return <PageLoader label="Armando la operación del día" />;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Administración"
        title="Operación diaria"
        description="Mapa en vivo, reservas del día y registro de ingresos, egresos y equipamiento."
        actions={
          <>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                void loadTable();
                void loadOccupancy();
              }}
            >
              <RefreshCw size={14} /> Actualizar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setWizardOpen(true)}>
              Nueva reserva
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Reservas del día" value={stats.total} hint={formatDateLong(date)} tone="teal" />
        <Metric label="Personas esperadas" value={stats.people} hint="Reservas activas" />
        <Metric label="En curso" value={stats.inProgress} hint="Requieren seguimiento" tone="gold" />
        <Metric label="Equipos pendientes" value={stats.pending} hint="Entregas o devoluciones" tone={stats.pending ? 'rose' : 'default'} />
      </div>

      <div className="card p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ops-date" className="sr-only">
              Fecha
            </label>
            <input
              id="ops-date"
              type="date"
              className="input w-auto"
              value={date}
              min={config?.today}
              max={config ? undefined : undefined}
              onChange={(event) => setDate(event.target.value)}
            />
            <div className="inline-flex rounded-full border border-line bg-[#f7f8f6] p-0.5" role="group" aria-label="Franja horaria">
              {(config?.settings.slots ?? []).map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSlotId(slot.id)}
                  aria-pressed={slotId === slot.id}
                  className={`rounded-full px-2.5 py-1.5 text-[0.7rem] font-semibold transition ${
                    slotId === slot.id ? 'bg-teal text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {slot.start}–{slot.end}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} /> {occupancy?.totals.people ?? 0} personas en el mapa
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardList size={13} /> {percent(occupancyRate, 0)} de ocupación
            </span>
          </div>
        </div>

        <div className="mt-3">
          <MapView
            floorplan={floorplan}
            occupancy={occupancy}
            height="h-[320px]"
            showSeats
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-serif text-lg text-ink">Reservas del día</p>
            <p className="text-xs text-muted">
              {tableLoading ? 'Actualizando…' : `${items.length} reservas · ${formatDateLong(date)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="input w-52 py-1.5 pl-8 text-xs"
                placeholder="Buscar titular o código"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Buscar reservas"
              />
            </div>
            <select
              className="select w-auto py-1.5 text-xs"
              value={space}
              onChange={(event) => setSpace(event.target.value)}
              aria-label="Filtrar por ambiente"
            >
              <option value="">Todos los ambientes</option>
              {floorplan.spaces
                .filter((item) => item.bookable)
                .map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
            </select>
            <select
              className="select w-auto py-1.5 text-xs"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtrar por estado"
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p role="alert" className="border-b border-rose/20 bg-rose-soft px-4 py-2.5 text-sm text-rose">
            {error}
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">No hay reservas con estos filtros.</p>
            <p className="mt-1 text-xs text-muted">Probá con otra fecha, ambiente o estado.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Franja / espacio</th>
                  <th>Titular</th>
                  <th>Personas</th>
                  <th>Equipos</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const pending = pendingEquipment(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <button
                          type="button"
                          className="font-semibold text-teal hover:underline"
                          onClick={() => setSelected(item.id)}
                        >
                          {item.code}
                        </button>
                      </td>
                      <td>
                        <p className="font-medium text-ink">{item.space.name}</p>
                        <p className="text-[0.7rem] text-muted">{item.slot.label}</p>
                      </td>
                      <td>
                        <p className="font-medium text-ink">
                          {item.holder.firstName} {item.holder.lastName}
                        </p>
                        <p className="text-[0.7rem] text-muted">DNI ****{item.holder.docLast4}</p>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1">
                          {item.partySize}
                          {item.companionsCount > 0 ? (
                            <span className="badge bg-gold-soft text-amber">+{item.companionsCount}</span>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        {pending.length === 0 ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <span className="badge bg-blue-soft text-blue">
                            <Laptop size={11} /> {pending.length}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {item.actions.canCheckIn ? (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => action(item.id, 'check-in')}
                              disabled={busy === `${item.id}:check-in`}
                            >
                              <CheckCircle2 size={12} /> Ingreso
                            </button>
                          ) : null}
                          {item.actions.canCheckOut ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => action(item.id, 'check-out')}
                              disabled={busy === `${item.id}:check-out`}
                            >
                              Finalizar
                            </button>
                          ) : null}
                          {item.actions.canNoShow ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => action(item.id, 'no-show')}
                              disabled={busy === `${item.id}:no-show`}
                              title="Marcar ausencia"
                            >
                              <ShieldAlert size={13} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSelected(item.id)}
                          >
                            Detalle <ArrowRight size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {user ? (
        <ReservationDetailModal
          reservationId={selected}
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          onChanged={() => {
            void loadTable();
            void loadOccupancy();
          }}
        />
      ) : null}

      <ReservationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          void loadTable();
          void loadOccupancy();
        }}
        config={config}
        defaultDate={date}
        defaultSlot={slotId}
        role="administrador"
      />
    </div>
  );
}
