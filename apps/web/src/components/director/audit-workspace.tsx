'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileClock,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { api, apiBlob, ApiError, downloadBlob } from '@/lib/api';
import { formatDateTime, todayISO, addDaysISO } from '@/lib/format';
import type { AuditItem, AuditResponse } from '@/lib/types';
import { useToast } from '@/components/providers/toast-provider';
import { EmptyState, Metric, PageLoader, SectionHeading } from '@/components/ui/primitives';

const ENTITY_LABELS: Record<string, string> = {
  reservation: 'Reserva',
  person: 'Persona',
  user: 'Usuario',
  equipment_item: 'Equipo',
  equipment_assignment: 'Asignación',
  system: 'Sistema',
};

const ROLE_LABELS: Record<string, string> = {
  socio: 'Socio',
  administrador: 'Administrador',
  director: 'Director',
  sistema: 'Sistema',
};

const ACTION_STYLES: Record<string, string> = {
  'reserva.creada': 'bg-teal-soft text-teal',
  'reserva.cancelada': 'bg-rose-soft text-rose',
  'reserva.editada': 'bg-blue-soft text-blue',
  'reserva.checkin': 'bg-teal-soft text-teal',
  'reserva.checkout': 'bg-[#eef1ee] text-muted',
  'reserva.no_show': 'bg-amber-soft text-amber',
  'equipo.entregado': 'bg-blue-soft text-blue',
  'equipo.devuelto': 'bg-teal-soft text-teal',
  'equipo.incidente': 'bg-amber-soft text-amber',
  'auth.login': 'bg-[#eef1ee] text-muted',
  'reporte.exportado': 'bg-gold-soft text-amber',
};

function actionStyle(action: string): string {
  return ACTION_STYLES[action] ?? 'bg-[#eef1ee] text-muted';
}

export function AuditWorkspace() {
  const { notify } = useToast();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState(addDaysISO(todayISO(), -29));
  const [to, setTo] = useState(todayISO());
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (action) params.set('action', action);
      if (entityType) params.set('entityType', entityType);
      if (query.trim()) params.set('q', query.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const result = await api<AuditResponse>(`/audit?${params.toString()}`);
      setData(result);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar la auditoría.');
    } finally {
      setLoading(false);
    }
  }, [action, entityType, query, from, to, offset]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 220);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [action, entityType, query, from, to]);

  async function exportCsv() {
    setExporting('csv');
    try {
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (query.trim()) params.set('q', query.trim());
      const { blob, filename } = await apiBlob(`/audit/export.csv?${params.toString()}`);
      downloadBlob(blob, filename || 'auditoria.csv');
      notify('Auditoría exportada en CSV.', 'success');
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No se pudo exportar la auditoría.', 'error');
    } finally {
      setExporting(null);
    }
  }

  const total = data?.total ?? 0;
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + limit, total);

  if (loading && !data) return <PageLoader label="Cargando la bitácora" />;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Dirección"
        title="Auditoría del sistema"
        description="Registro inmutable de las acciones realizadas sobre reservas, personas y equipamiento."
        actions={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
              <RefreshCw size={14} /> Actualizar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv} disabled={exporting === 'csv'}>
              <Download size={14} /> {exporting === 'csv' ? 'Exportando…' : 'Exportar CSV'}
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Eventos en el filtro" value={total} hint={`Revisión de datos ${data?.revision ?? '—'}`} tone="teal" />
        <Metric
          label="Tipos de acción"
          value={data?.actions.length ?? 0}
          hint="Acciones distintas registradas en el sistema"
        />
        <Metric label="Mostrando" value={`${showingFrom}–${showingTo}`} hint={`Página de ${limit} eventos`} />
        <Metric
          label="Período consultado"
          value={data ? `${from.slice(8, 10)}/${from.slice(5, 7)} – ${to.slice(8, 10)}/${to.slice(5, 7)}` : '—'}
          hint="Fecha de los eventos"
          tone="gold"
        />
      </div>

      <div className="card p-3.5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="audit-from" className="label">
                Desde
              </label>
              <input
                id="audit-from"
                type="date"
                className="input w-auto"
                value={from}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-to" className="label">
                Hasta
              </label>
              <input
                id="audit-to"
                type="date"
                className="input w-auto"
                value={to}
                min={from}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-action" className="label">
                Acción
              </label>
              <select
                id="audit-action"
                className="select w-auto"
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="">Todas las acciones</option>
                {(data?.actions ?? []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-entity" className="label">
                Entidad
              </label>
              <select
                id="audit-entity"
                className="select w-auto"
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
              >
                <option value="">Todas las entidades</option>
                {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-search" className="label">
                Buscar
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="audit-search"
                  className="input w-56 pl-8 text-sm"
                  placeholder="Actor, email, entidad o id"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setAction('');
              setEntityType('');
              setQuery('');
              setFrom(addDaysISO(todayISO(), -29));
              setTo(todayISO());
            }}
          >
            <Filter size={13} /> Limpiar filtros
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose/25 bg-rose-soft px-3.5 py-2.5 text-sm text-rose">
          {error}
        </p>
      ) : null}

      {(data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No hay eventos con estos filtros"
          description="Ampliá el rango de fechas o quitá filtros para ver la actividad registrada."
          icon={<FileClock size={28} />}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck size={15} className="text-teal" />
              Bitácora de cambios
            </p>
            <p className="text-xs text-muted">
              {loading ? 'Actualizando…' : `${total} eventos · mostrando ${showingFrom} a ${showingTo}`}
            </p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-6" />
                  <th>Fecha y hora</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Actor</th>
                  <th>Rol</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((item: AuditItem) => {
                  const open = expanded === item.id;
                  return (
                    <Fragment key={item.id}>
                      <tr className={open ? 'bg-[#f7f8f6]' : undefined}>
                        <td>
                          <button
                            type="button"
                            className="rounded p-1 text-muted hover:bg-white hover:text-teal"
                            onClick={() => setExpanded(open ? null : item.id)}
                            aria-expanded={open}
                            aria-label={open ? 'Ocultar detalle' : 'Ver detalle del evento'}
                          >
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(item.at)}</td>
                        <td>
                          <span className={`badge ${actionStyle(item.action)}`}>{item.action}</span>
                        </td>
                        <td>
                          <p className="text-sm text-ink">{ENTITY_LABELS[item.entityType] ?? item.entityType}</p>
                          <p className="max-w-40 truncate text-[0.65rem] text-muted">{item.entityId}</p>
                        </td>
                        <td>
                          <p className="text-sm text-ink">{item.actor}</p>
                          {item.actorEmail ? (
                            <p className="max-w-44 truncate text-[0.65rem] text-muted">{item.actorEmail}</p>
                          ) : null}
                        </td>
                        <td>
                          <span className="badge bg-[#eef1ee] text-muted">
                            {ROLE_LABELS[item.actorRole] ?? item.actorRole}
                          </span>
                        </td>
                        <td className="text-[0.7rem] text-muted">{item.ip ?? '—'}</td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={7} className="bg-[#fbfcfa]">
                            <div className="grid gap-3 py-1 sm:grid-cols-2">
                              <div>
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">
                                  Antes
                                </p>
                                <pre className="mt-1 max-h-52 overflow-auto rounded-lg border border-line bg-white p-2.5 text-[0.68rem] leading-relaxed text-ink">
                                  {item.before ? JSON.stringify(item.before, null, 2) : 'Sin datos previos'}
                                </pre>
                              </div>
                              <div>
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">
                                  Después
                                </p>
                                <pre className="mt-1 max-h-52 overflow-auto rounded-lg border border-line bg-white p-2.5 text-[0.68rem] leading-relaxed text-ink">
                                  {item.after ? JSON.stringify(item.after, null, 2) : 'Sin datos posteriores'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
            <p className="text-xs text-muted">
              Página {Math.floor(offset / limit) + 1} de {Math.max(1, Math.ceil(total / limit))}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setOffset((current) => Math.max(0, current - limit))}
                disabled={offset === 0 || loading}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setOffset((current) => current + limit)}
                disabled={offset + limit >= total || loading}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="rounded-xl border border-line bg-white px-4 py-3 text-[0.68rem] leading-relaxed text-muted">
        La bitácora se escribe en el mismo archivo transaccional que el resto del estado y conserva el
        antes y el después de cada cambio. Sólo el rol director puede consultarla o exportarla.
      </p>
    </div>
  );
}
