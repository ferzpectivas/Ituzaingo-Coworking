'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Download,
  Laptop,
  MapPin,
  MonitorPlay,
  Presentation,
  RotateCcw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { api, apiBlob, ApiError, downloadBlob } from '@/lib/api';
import { formatDateLong, formatDateTime } from '@/lib/format';
import type { ReservationDetail, TimelineEvent } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { EmptyState, Modal, Spinner, StatusBadge } from '@/components/ui/primitives';
import { EquipmentChecklistForm } from '@/components/equipment/equipment-checklist';

export function ReservationDetailModal({
  reservationId,
  open,
  onClose,
  onChanged,
}: {
  reservationId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [checklist, setChecklist] = useState<Record<string, 'deliver' | 'return' | undefined>>({});

  const load = useCallback(async () => {
    if (!reservationId) return;
    setLoading(true);
    setError(null);
    try {
      const [reservation, events] = await Promise.all([
        api<ReservationDetail>(`/reservations/${reservationId}`),
        api<{ items: TimelineEvent[] }>(`/reservations/${reservationId}/timeline`),
      ]);
      setDetail(reservation);
      setTimeline(events.items);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar la reserva.');
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    if (open) {
      setDetail(null);
      setTimeline([]);
      setCancelOpen(false);
      setReason('');
      setChecklist({});
      void load();
    }
  }, [open, load]);

  async function runAction(action: 'check-in' | 'check-out' | 'no-show') {
    if (!detail) return;
    setActionLoading(action);
    try {
      await api(`/reservations/${detail.id}/${action}`, { method: 'POST' });
      notify(
        action === 'check-in'
          ? 'Ingreso registrado.'
          : action === 'check-out'
            ? 'Reserva finalizada.'
            : 'Reserva marcada como ausente.',
        'success',
      );
      await load();
      onChanged?.();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No se pudo completar la acción.', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmCancel() {
    if (!detail) return;
    setActionLoading('cancel');
    try {
      await api(`/reservations/${detail.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      notify('Reserva cancelada.', 'success');
      setCancelOpen(false);
      await load();
      onChanged?.();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No se pudo cancelar la reserva.', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function downloadIcs() {
    if (!detail) return;
    try {
      const { blob, filename } = await apiBlob(`/reservations/${detail.id}/ics`);
      downloadBlob(blob, filename || `reserva-${detail.code}.ics`);
    } catch {
      notify('No se pudo descargar el archivo iCalendar.', 'error');
    }
  }

  const isAdmin = user?.role === 'administrador';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={detail ? `Reserva ${detail.code}` : 'Detalle de la reserva'}
      description={detail ? `${detail.space.name} · ${formatDateLong(detail.date)}` : 'Cargando información'}
      footer={
        detail ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cerrar
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={downloadIcs}>
                <Download size={14} /> iCalendar
              </button>
              {detail.actions.canCancel ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setCancelOpen((current) => !current)}
                >
                  Cancelar reserva
                </button>
              ) : null}
              {isAdmin && detail.actions.canCheckIn ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => runAction('check-in')}
                  disabled={actionLoading === 'check-in'}
                >
                  <Clock3 size={14} /> Registrar ingreso
                </button>
              ) : null}
              {isAdmin && detail.actions.canCheckOut ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => runAction('check-out')}
                  disabled={actionLoading === 'check-out'}
                >
                  <CheckIcon /> Finalizar
                </button>
              ) : null}
              {isAdmin && detail.actions.canNoShow ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => runAction('no-show')}
                  disabled={actionLoading === 'no-show'}
                >
                  <ShieldAlert size={14} /> Ausente
                </button>
              ) : null}
            </div>
          </div>
        ) : null
      }
    >
      {loading ? (
        <div className="py-10 text-center">
          <Spinner label="Cargando reserva" />
        </div>
      ) : error ? (
        <EmptyState title="No se pudo abrir la reserva" description={error} />
      ) : detail ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge status={detail.status} />
            <p className="text-xs text-muted">Actualizada {formatDateTime(detail.updatedAt)}</p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3">
              <dt className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-wide text-muted">
                <MapPin size={12} /> Espacio
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">{detail.space.name}</dd>
            </div>
            <div className="rounded-xl border border-line p-3">
              <dt className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-wide text-muted">
                <CalendarDays size={12} /> Fecha y franja
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {formatDateLong(detail.date)} · {detail.slot.label}
              </dd>
            </div>
            <div className="rounded-xl border border-line p-3">
              <dt className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-wide text-muted">
                <Users size={12} /> Titular
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {detail.holder.firstName} {detail.holder.lastName}
                <span className="ml-1 font-normal text-muted">· DNI ****{detail.holder.docLast4}</span>
              </dd>
            </div>
            <div className="rounded-xl border border-line p-3">
              <dt className="text-[0.68rem] uppercase tracking-wide text-muted">Puestos</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">
                {detail.seats.map((seat) => seat.furnitureLabel).filter(Boolean).join(' · ') || '—'}
              </dd>
            </div>
          </dl>

          <section>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink">Personas ({detail.partySize})</h4>
              {detail.companionsCount > 0 ? (
                <span className="badge bg-gold-soft text-amber">+ {detail.companionsCount} acompañantes</span>
              ) : null}
            </div>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {detail.people.map((person, index) => (
                <li key={`${person.firstName}-${index}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="text-xs font-semibold text-muted">{index === 0 ? 'Titular' : `Acompañante ${index}`}</span>
                  <span className="flex-1 font-medium text-ink">
                    {person.firstName} {person.lastName}
                  </span>
                  <span className="text-xs text-muted">
                    {person.docType} ****{person.docLast4}
                  </span>
                  {person.checkedInAt ? (
                    <span className="badge bg-teal-soft text-teal">Ingresó</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Laptop size={15} className="text-teal" /> Equipamiento
            </h4>
            {detail.equipment.length === 0 ? (
              <p className="mt-1 rounded-xl border border-dashed border-line px-3 py-3 text-sm text-muted">
                Esta reserva no solicitó equipamiento.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {detail.equipment.map((item) => {
                  const mode = checklist[item.assignmentId];
                  return (
                    <li key={item.assignmentId} className="rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            {item.type === 'computadora' ? (
                              <Laptop size={14} className="text-teal" />
                            ) : item.type === 'proyector' ? (
                              <MonitorPlay size={14} className="text-blue" />
                            ) : (
                              <Presentation size={14} className="text-amber" />
                            )}
                            {item.assetTag}
                            <span className="text-xs font-normal text-muted">{item.model}</span>
                          </p>
                          <p className="mt-0.5 text-[0.7rem] text-muted">
                            {item.status === 'reservada'
                              ? 'Reservado · pendiente de entrega'
                              : item.status === 'entregada'
                                ? 'Entregado · pendiente de devolución'
                                : item.status === 'devuelta'
                                  ? `Devuelto ${formatDateTime(item.returned?.at)}`
                                  : 'Asignación cancelada'}
                          </p>
                        </div>
                        {isAdmin && item.status === 'reservada' ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() =>
                              setChecklist((current) => ({
                                ...current,
                                [item.assignmentId]: mode === 'deliver' ? undefined : 'deliver',
                              }))
                            }
                          >
                            Registrar entrega
                          </button>
                        ) : null}
                        {isAdmin && item.status === 'entregada' ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() =>
                              setChecklist((current) => ({
                                ...current,
                                [item.assignmentId]: mode === 'return' ? undefined : 'return',
                              }))
                            }
                          >
                            <RotateCcw size={13} /> Registrar devolución
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.requiredAccessories.map((accessory) => (
                          <span
                            key={accessory.code}
                            className={`badge ${accessory.present ? 'bg-teal-soft text-teal' : 'bg-rose-soft text-rose'}`}
                          >
                            {accessory.label}
                          </span>
                        ))}
                      </div>

                      {item.incident ? (
                        <p className="mt-2 rounded-lg bg-amber-soft px-2.5 py-1.5 text-[0.7rem] text-amber">
                          Incidente {item.incident.kind}: {item.incident.description}
                          {item.incident.resolved ? ' · resuelto' : ' · pendiente'}
                        </p>
                      ) : null}

                      {mode ? (
                        <EquipmentChecklistForm
                          assignment={item}
                          mode={mode}
                          onDone={async () => {
                            setChecklist((current) => ({ ...current, [item.assignmentId]: undefined }));
                            await load();
                            onChanged?.();
                          }}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {detail.notes ? (
            <section>
              <h4 className="text-sm font-semibold text-ink">Notas</h4>
              <p className="mt-1 rounded-xl bg-[#f7f8f6] px-3 py-2.5 text-sm leading-relaxed text-muted">
                {detail.notes}
              </p>
            </section>
          ) : null}

          {cancelOpen ? (
            <section className="rounded-xl border border-rose/25 bg-rose-soft/60 p-3">
              <p className="text-sm font-semibold text-rose">Confirmar cancelación</p>
              <p className="mt-0.5 text-xs text-ink/70">
                Se liberarán los puestos y el equipamiento reservado. Esta acción no se puede deshacer.
              </p>
              <label className="label mt-2" htmlFor="cancel-reason">
                Motivo (opcional)
              </label>
              <input
                id="cancel-reason"
                className="input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej. cambio de agenda"
                maxLength={300}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={confirmCancel}
                  disabled={actionLoading === 'cancel'}
                >
                  {actionLoading === 'cancel' ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCancelOpen(false)}>
                  Volver
                </button>
              </div>
            </section>
          ) : null}

          <section>
            <details className="group rounded-xl border border-line">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-ink">
                Historial de la reserva
                <span className="ml-1 text-xs font-normal text-muted">({timeline.length} eventos)</span>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {timeline.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted">Sin eventos registrados.</li>
                ) : (
                  timeline.map((event) => (
                    <li key={event.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                      <span className="font-semibold text-ink">{event.action}</span>
                      <span className="text-muted">{event.actor}</span>
                      <span className="ml-auto text-muted">{formatDateTime(event.at)}</span>
                    </li>
                  ))
                )}
              </ul>
            </details>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
