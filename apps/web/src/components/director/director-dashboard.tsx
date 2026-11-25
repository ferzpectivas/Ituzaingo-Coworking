'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Laptop,
  MonitorPlay,
  Presentation,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api, apiBlob, ApiError, downloadBlob } from '@/lib/api';
import { addDaysISO, formatDate, percent, todayISO } from '@/lib/format';
import type { ReportSummary } from '@/lib/types';
import { useToast } from '@/components/providers/toast-provider';
import { Metric, PageLoader, ProgressBar, SectionHeading } from '@/components/ui/primitives';

type ReportType = 'resumen' | 'reservas' | 'ocupacion' | 'equipos';
type ExportFormat = 'pdf' | 'csv' | 'xlsx';

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: 'PDF',
  csv: 'CSV',
  xlsx: 'Excel',
};

const FORMAT_ICON = {
  pdf: FileText,
  csv: FileText,
  xlsx: FileSpreadsheet,
} as const;

const PRESETS = [
  { id: '7', label: 'Últimos 7 días' },
  { id: '30', label: 'Últimos 30 días' },
  { id: '90', label: 'Últimos 90 días' },
  { id: 'mes', label: 'Mes en curso' },
];

function monthStart(): string {
  const today = todayISO();
  return `${today.slice(0, 7)}-01`;
}

export function DirectorDashboard() {
  const { notify } = useToast();
  const [from, setFrom] = useState(addDaysISO(todayISO(), -29));
  const [to, setTo] = useState(todayISO());
  const [space, setSpace] = useState('');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    api<{ spaces: Array<{ code: string; name: string; bookable: boolean }> }>('/spaces')
      .then((result) => {
        setSpaces(result.spaces.filter((item) => item.bookable).map((item) => ({ code: item.code, name: item.name })));
      })
      .catch(() => setSpaces([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (space) params.set('space', space);
      const result = await api<ReportSummary>(`/reports/summary?${params.toString()}`);
      setSummary(result);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los indicadores.');
    } finally {
      setLoading(false);
    }
  }, [from, to, space]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(id: string) {
    if (id === 'mes') {
      setFrom(monthStart());
      setTo(todayISO());
      return;
    }
    setTo(todayISO());
    setFrom(addDaysISO(todayISO(), -(Number(id) - 1)));
  }

  async function exportReport(format: ExportFormat, type: ReportType) {
    const key = `${format}:${type}`;
    setExporting(key);
    try {
      const params = new URLSearchParams({ format, type, from, to });
      if (space) params.set('space', space);
      const { blob, filename } = await apiBlob(`/reports/export?${params.toString()}`);
      downloadBlob(blob, filename);
      notify(`Reporte ${FORMAT_LABEL[format]} descargado.`, 'success');
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No se pudo generar el reporte.', 'error');
    } finally {
      setExporting(null);
    }
  }

  const peakPeople = useMemo(
    () => (summary ? Math.max(1, ...summary.byDay.map((day) => day.people)) : 1),
    [summary],
  );

  const weekdayPeak = useMemo(
    () => (summary ? Math.max(1, ...summary.byWeekday.map((day) => day.people)) : 1),
    [summary],
  );

  const rangeWarning = useMemo(() => {
    if (!summary) return null;
    if (summary.range.days > 92) return 'El rango es extenso: los gráficos diarios pueden requerir desplazamiento horizontal.';
    return null;
  }, [summary]);

  if (loading && !summary) return <PageLoader label="Calculando indicadores" />;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Dirección"
        title="Tablero de gestión"
        description="Indicadores de ocupación, uso del equipamiento y comportamiento de las reservas. Vista de sólo lectura."
        actions={
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            <RefreshCw size={14} /> Recalcular
          </button>
        }
      />

      <div className="card p-3.5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="report-from" className="label">
                Desde
              </label>
              <input
                id="report-from"
                type="date"
                className="input w-auto"
                value={from}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="report-to" className="label">
                Hasta
              </label>
              <input
                id="report-to"
                type="date"
                className="input w-auto"
                value={to}
                min={from}
                max={todayISO()}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="report-space" className="label">
                Ambiente
              </label>
              <select
                id="report-space"
                className="select w-auto"
                value={space}
                onChange={(event) => setSpace(event.target.value)}
              >
                <option value="">Todos los ambientes</option>
                {spaces.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-0.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="rounded-full border border-line bg-white px-2.5 py-1.5 text-[0.68rem] font-semibold text-muted transition hover:border-teal/40 hover:text-teal"
                  onClick={() => applyPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <CalendarRange size={13} />
              {summary?.range.label ?? `${from} a ${to}`} · {summary?.range.days ?? 0} días
            </span>
            {(['pdf', 'xlsx', 'csv'] as ExportFormat[]).map((format) => {
              const Icon = FORMAT_ICON[format];
              return (
                <button
                  key={format}
                  type="button"
                  className={format === 'pdf' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                  onClick={() => void exportReport(format, 'resumen')}
                  disabled={exporting === `${format}:resumen`}
                >
                  <Icon size={14} />
                  {exporting === `${format}:resumen` ? 'Generando…' : FORMAT_LABEL[format]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose/25 bg-rose-soft px-3.5 py-2.5 text-sm text-rose">
          {error}
        </p>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Ocupación promedio"
              value={percent(summary.totals.occupancyRate, 1)}
              hint={`${summary.totals.occupiedSeatSlots} de ${summary.totals.availableSeatSlots} puestos-franja`}
              tone="teal"
            />
            <Metric
              label="Personas atendidas"
              value={summary.totals.people}
              hint={`${summary.totals.activeReservations} reservas activas`}
            />
            <Metric
              label="Cancelaciones"
              value={percent(summary.totals.cancellationRate, 1)}
              hint={`${summary.totals.cancelled} reservas canceladas`}
              tone={summary.totals.cancellationRate > 0.15 ? 'rose' : 'default'}
            />
            <Metric
              label="Ausencias"
              value={percent(summary.totals.noShowRate, 1)}
              hint={`${summary.totals.noShow} reservas sin presentarse`}
              tone={summary.totals.noShowRate > 0.1 ? 'gold' : 'default'}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">Promedio por reserva</p>
              <p className="mt-1 flex items-baseline gap-1 font-serif text-2xl text-ink">
                {summary.totals.averagePartySize.toFixed(1)}
                <span className="text-xs font-sans font-normal text-muted">personas</span>
              </p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">Día de mayor demanda</p>
              <p className="mt-1 font-serif text-lg leading-tight text-ink">
                {summary.peak.day ? formatDate(summary.peak.day.date, { weekday: 'short' }) : '—'}
              </p>
              <p className="text-[0.68rem] text-muted">
                {summary.peak.day ? `${summary.peak.day.people} personas · ${summary.peak.day.reservations} reservas` : 'Sin datos'}
              </p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">Franja más usada</p>
              <p className="mt-1 font-serif text-lg leading-tight text-ink">{summary.peak.slot?.label ?? '—'}</p>
              <p className="text-[0.68rem] text-muted">
                {summary.peak.slot ? `${summary.peak.slot.people} personas en el período` : 'Sin datos'}
              </p>
            </div>
            <div className="card px-4 py-3">
              <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">
                <Gauge size={12} /> Utilización de equipos
              </p>
              <p className="mt-1 font-serif text-2xl text-ink">{percent(summary.equipment.utilizationRate, 1)}</p>
              <p className="text-[0.68rem] text-muted">{summary.equipment.reservations} asignaciones en el período</p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-serif text-lg text-ink">Personas por día</p>
                  <p className="text-xs text-muted">Ocupación diaria y reservas registradas</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal">
                  <TrendingUp size={13} /> Máx. {peakPeople}
                </span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <div className="flex min-w-full items-end gap-1" style={{ minWidth: Math.max(summary.byDay.length * 18, 100) }}>
                  {summary.byDay.map((day) => {
                    const height = Math.round((day.people / peakPeople) * 100);
                    return (
                      <div key={day.date} className="group flex min-w-[12px] flex-1 flex-col items-center gap-1">
                        <div className="relative flex h-32 w-full items-end">
                          <div
                            className={`w-full rounded-t transition ${day.open ? 'bg-teal/80 group-hover:bg-teal' : 'bg-line'}`}
                            style={{ height: `${day.open ? Math.max(height, day.people > 0 ? 4 : 1) : 2}%` }}
                            title={
                              day.open
                                ? `${formatDate(day.date)}: ${day.people} personas · ${day.reservations} reservas`
                                : `${formatDate(day.date)}: cerrado`
                            }
                          />
                        </div>
                        <span className="rotate-0 text-[0.55rem] text-muted">
                          {day.date.slice(8, 10)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.68rem] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-teal" /> Personas
                </span>
                <span>{summary.byDay.reduce((acc, day) => acc + day.cancelled, 0)} cancelaciones en el período</span>
                {rangeWarning ? <span className="text-amber">{rangeWarning}</span> : null}
              </div>
            </div>

            <div className="card p-4">
              <p className="font-serif text-lg text-ink">Ocupación por ambiente</p>
              <p className="text-xs text-muted">Porcentaje de puestos-franja utilizados</p>
              <ul className="mt-4 space-y-3">
                {summary.bySpace.map((item) => (
                  <li key={item.code}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-ink">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                        {item.name}
                      </span>
                      <span className="text-muted">
                        {item.people} pers. · {percent(item.occupancyRate, 0)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar value={item.occupancyRate} tone="teal" />
                    </div>
                    <p className="mt-1 text-[0.62rem] text-muted">
                      {item.reservations} reservas · {item.cancelled} canceladas · {item.noShow} ausentes
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="card p-4">
              <p className="font-serif text-lg text-ink">Por franja horaria</p>
              <ul className="mt-3 space-y-3">
                {summary.bySlot.map((slot) => (
                  <li key={slot.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">{slot.label}</span>
                      <span className="text-muted">{percent(slot.occupancyRate, 0)}</span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar value={slot.occupancyRate} tone="gold" />
                    </div>
                    <p className="mt-0.5 text-[0.62rem] text-muted">
                      {slot.reservations} reservas · {slot.people} personas
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4">
              <p className="font-serif text-lg text-ink">Días de la semana</p>
              <p className="text-xs text-muted">Personas acumuladas por día</p>
              <ul className="mt-3 space-y-2">
                {summary.byWeekday.map((day) => (
                  <li key={day.weekday} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-muted">{day.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf0ec]">
                      <div
                        className="h-full rounded-full bg-blue"
                        style={{ width: `${Math.round((day.people / weekdayPeak) * 100)}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-semibold text-ink">
                      {day.people} <span className="font-normal text-muted">pers.</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4">
              <p className="flex items-center gap-2 font-serif text-lg text-ink">
                <Laptop size={17} className="text-teal" /> Equipamiento
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-teal-soft/60 px-3 py-2">
                  <dt className="text-[0.62rem] uppercase tracking-wide text-teal">Notebooks</dt>
                  <dd className="font-serif text-xl text-ink">{summary.equipment.computers}</dd>
                </div>
                <div className="rounded-lg bg-blue-soft/60 px-3 py-2">
                  <dt className="flex items-center gap-1 text-[0.62rem] uppercase tracking-wide text-blue">
                    <MonitorPlay size={10} /> Proyectores
                  </dt>
                  <dd className="font-serif text-xl text-ink">{summary.equipment.projectors}</dd>
                </div>
                <div className="rounded-lg bg-gold-soft/60 px-3 py-2">
                  <dt className="flex items-center gap-1 text-[0.62rem] uppercase tracking-wide text-amber">
                    <Presentation size={10} /> Pizarras
                  </dt>
                  <dd className="font-serif text-xl text-ink">{summary.equipment.whiteboards}</dd>
                </div>
                <div className="rounded-lg bg-[#f7f8f6] px-3 py-2">
                  <dt className="text-[0.62rem] uppercase tracking-wide text-muted">Entregas</dt>
                  <dd className="font-serif text-xl text-ink">{summary.equipment.deliveries}</dd>
                </div>
                <div className="rounded-lg bg-[#f7f8f6] px-3 py-2">
                  <dt className="text-[0.62rem] uppercase tracking-wide text-muted">Devoluciones</dt>
                  <dd className="font-serif text-xl text-ink">{summary.equipment.returns}</dd>
                </div>
                <div className="col-span-2 rounded-lg bg-amber-soft/70 px-3 py-2">
                  <dt className="text-[0.62rem] uppercase tracking-wide text-amber">Incidentes</dt>
                  <dd className="flex items-baseline gap-2 font-serif text-xl text-ink">
                    {summary.equipment.incidents}
                    <span className="text-xs font-sans font-normal text-muted">
                      {summary.equipment.incidentsOpen} sin resolver
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(['reservas', 'ocupacion', 'equipos'] as ReportType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void exportReport('xlsx', type)}
                    disabled={exporting === `xlsx:${type}`}
                  >
                    <Download size={12} /> {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">Exportaciones del período</p>
                <p className="text-xs text-muted">
                  Documentos con la identidad institucional, listos para presentar o archivar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['resumen', 'reservas', 'ocupacion', 'equipos'] as ReportType[]).map((type) => (
                  <div key={type} className="flex overflow-hidden rounded-full border border-line">
                    <span className="bg-[#f7f8f6] px-2.5 py-1.5 text-[0.68rem] font-semibold capitalize text-muted">
                      {type}
                    </span>
                    {(['pdf', 'xlsx', 'csv'] as ExportFormat[]).map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => void exportReport(format, type)}
                        disabled={exporting === `${format}:${type}`}
                        className="border-l border-line px-2 py-1.5 text-[0.68rem] font-semibold text-teal transition hover:bg-teal-soft disabled:opacity-50"
                      >
                        {FORMAT_LABEL[format]}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[0.7rem] leading-relaxed text-muted">
              <Users size={13} className="mt-0.5 shrink-0" />
              Los reportes incluyen únicamente los últimos cuatro dígitos del documento de las personas.
              Las exportaciones quedan registradas en la auditoría del sistema.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
