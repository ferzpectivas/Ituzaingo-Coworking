'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Laptop,
  MonitorPlay,
  PackageCheck,
  Plus,
  Presentation,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateTime, todayISO } from '@/lib/format';
import type { EquipmentAssignment, EquipmentInventory, EquipmentItem } from '@/lib/types';
import { useToast } from '@/components/providers/toast-provider';
import { EquipmentChecklistForm } from '@/components/equipment/equipment-checklist';
import {
  EmptyState,
  Metric,
  Modal,
  PageLoader,
  SectionHeading,
  Tabs,
} from '@/components/ui/primitives';

const TYPE_LABEL: Record<string, string> = {
  computadora: 'Notebook',
  proyector: 'Proyector',
  pizarra: 'Pizarra',
};

const STATUS_LABEL: Record<string, string> = {
  disponible: 'Disponible',
  en_uso: 'En uso',
  mantenimiento: 'Mantenimiento',
  reservada: 'Reservada',
  entregada: 'Entregada',
  devuelta: 'Devuelta',
  cancelada: 'Cancelada',
};

const STATUS_STYLE: Record<string, string> = {
  disponible: 'bg-teal-soft text-teal',
  en_uso: 'bg-blue-soft text-blue',
  mantenimiento: 'bg-amber-soft text-amber',
  reservada: 'bg-[#eef1ee] text-muted',
  entregada: 'bg-blue-soft text-blue',
  devuelta: 'bg-teal-soft text-teal',
  cancelada: 'bg-rose-soft text-rose',
};

export function EquipmentWorkspace() {
  const { notify } = useToast();
  const [inventory, setInventory] = useState<EquipmentInventory | null>(null);
  const [assignments, setAssignments] = useState<EquipmentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'inventario' | 'asignaciones'>('inventario');

  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');

  const [assignmentStatus, setAssignmentStatus] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(todayISO());

  const [createOpen, setCreateOpen] = useState(false);
  const [openChecklist, setOpenChecklist] = useState<Record<string, 'deliver' | 'return' | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (query.trim()) params.set('q', query.trim());
    const result = await api<EquipmentInventory>(`/equipment?${params.toString()}`);
    setInventory(result);
  }, [type, status, query]);

  const loadAssignments = useCallback(async () => {
    const params = new URLSearchParams();
    if (assignmentStatus) params.set('status', assignmentStatus);
    if (assignmentDate) params.set('date', assignmentDate);
    const result = await api<{ items: EquipmentAssignment[]; total: number }>(
      `/equipment/assignments?${params.toString()}`,
    );
    setAssignments(result.items);
  }, [assignmentStatus, assignmentDate]);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadInventory(), loadAssignments()]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar el equipamiento.');
    } finally {
      setLoading(false);
    }
  }, [loadInventory, loadAssignments]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadAll]);

  async function changeStatus(item: EquipmentItem, next: 'disponible' | 'mantenimiento') {
    setBusy(`${item.id}:status`);
    try {
      await api(`/equipment/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      notify(
        next === 'mantenimiento'
          ? `${item.assetTag} pasó a mantenimiento.`
          : `${item.assetTag} vuelve a estar disponible.`,
        'success',
      );
      await loadAll();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No se pudo actualizar el equipo.', 'error');
    } finally {
      setBusy(null);
    }
  }

  const pendingAssignments = useMemo(
    () => assignments.filter((item) => item.status === 'reservada' || item.status === 'entregada'),
    [assignments],
  );

  if (loading) return <PageLoader label="Cargando inventario" />;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Administración"
        title="Equipamiento"
        description="Inventario de notebooks, proyectores y pizarras, asignaciones por reserva y control de accesorios."
        actions={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadAll()}>
              <RefreshCw size={14} /> Actualizar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Alta de equipo
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Equipos totales"
          value={inventory?.totals.total ?? 0}
          hint={`${inventory?.totals.computadoras ?? 0} notebooks · ${inventory?.totals.proyectores ?? 0} proyectores · ${inventory?.totals.pizarras ?? 0} pizarras`}
          tone="teal"
        />
        <Metric label="Disponibles" value={inventory?.totals.disponibles ?? 0} hint="Listos para asignar" />
        <Metric label="En uso" value={inventory?.totals.enUso ?? 0} hint="Entregados en reservas activas" tone="gold" />
        <Metric
          label="Mantenimiento"
          value={inventory?.totals.mantenimiento ?? 0}
          hint="Con incidentes o revisión técnica"
          tone={inventory?.totals.mantenimiento ? 'rose' : 'default'}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose/25 bg-rose-soft px-3.5 py-2.5 text-sm text-rose">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          label="Vistas de equipamiento"
          value={tab}
          onChange={(value) => setTab(value as 'inventario' | 'asignaciones')}
          items={[
            { value: 'inventario', label: 'Inventario', count: inventory?.totals.total ?? 0 },
            { value: 'asignaciones', label: 'Asignaciones', count: assignments.length },
          ]}
        />
        {tab === 'inventario' ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="input w-52 py-1.5 pl-8 text-xs"
                placeholder="Buscar código, modelo o serie"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Buscar equipos"
              />
            </div>
            <select
              className="select w-auto py-1.5 text-xs"
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos los tipos</option>
              <option value="computadora">Notebooks</option>
              <option value="proyector">Proyectores</option>
              <option value="pizarra">Pizarras</option>
            </select>
            <select
              className="select w-auto py-1.5 text-xs"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              <option value="disponible">Disponibles</option>
              <option value="en_uso">En uso</option>
              <option value="mantenimiento">Mantenimiento</option>
            </select>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input w-auto py-1.5 text-xs"
              value={assignmentDate}
              onChange={(event) => setAssignmentDate(event.target.value)}
              aria-label="Fecha de asignaciones"
            />
            <select
              className="select w-auto py-1.5 text-xs"
              value={assignmentStatus}
              onChange={(event) => setAssignmentStatus(event.target.value)}
              aria-label="Filtrar asignaciones por estado"
            >
              <option value="">Todas</option>
              <option value="reservada">Reservadas</option>
              <option value="entregada">Entregadas</option>
              <option value="devuelta">Devueltas</option>
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setAssignmentDate('');
                setAssignmentStatus('');
              }}
            >
              Ver todo
            </button>
          </div>
        )}
      </div>

      {tab === 'inventario' ? (
        (inventory?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="Sin equipos con estos filtros"
            description="Probá con otro tipo, estado o término de búsqueda."
            icon={<Boxes size={28} />}
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Activo</th>
                    <th>Tipo</th>
                    <th>Modelo / serie</th>
                    <th>Accesorios</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(inventory?.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <p className="font-semibold text-ink">{item.assetTag}</p>
                        <p className="text-[0.68rem] text-muted">Actualizado {formatDate(item.updatedAt.slice(0, 10))}</p>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                          {item.type === 'computadora' ? (
                            <Laptop size={14} className="text-teal" />
                          ) : item.type === 'proyector' ? (
                            <MonitorPlay size={14} className="text-blue" />
                          ) : (
                            <Presentation size={14} className="text-amber" />
                          )}
                          {TYPE_LABEL[item.type]}
                        </span>
                      </td>
                      <td>
                        <p className="text-sm text-ink">{item.model}</p>
                        <p className="text-[0.68rem] text-muted">S/N {item.serial}</p>
                      </td>
                      <td>
                        <div className="flex max-w-52 flex-wrap gap-1">
                          {item.accessories.map((accessory) => (
                            <span
                              key={accessory.code}
                              className={`badge ${
                                accessory.present ? 'bg-teal-soft text-teal' : 'bg-rose-soft text-rose'
                              }`}
                            >
                              {accessory.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_STYLE[item.status] ?? 'bg-[#eef1ee] text-muted'}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {item.status !== 'mantenimiento' ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => changeStatus(item, 'mantenimiento')}
                              disabled={busy === `${item.id}:status`}
                              title="Enviar a mantenimiento"
                            >
                              <Wrench size={13} /> Mantenimiento
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => changeStatus(item, 'disponible')}
                              disabled={busy === `${item.id}:status`}
                            >
                              <PackageCheck size={13} /> Disponible
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : assignments.length === 0 ? (
        <EmptyState
          title="Sin asignaciones para mostrar"
          description="Cambiá la fecha o el estado para ver reservas de equipamiento."
          icon={<Boxes size={28} />}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            {pendingAssignments.length} asignaciones pendientes de entrega o devolución sobre {assignments.length} registros.
          </p>
          {assignments.map((assignment) => {
            const mode = openChecklist[assignment.id];
            return (
              <div key={assignment.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {assignment.type === 'computadora' ? (
                        <Laptop size={15} className="text-teal" />
                      ) : assignment.type === 'proyector' ? (
                        <MonitorPlay size={15} className="text-blue" />
                      ) : (
                        <Presentation size={15} className="text-amber" />
                      )}
                      {assignment.assetTag}
                      <span className="font-normal text-muted">{assignment.model}</span>
                      <span className={`badge ${STATUS_STYLE[assignment.status] ?? 'bg-[#eef1ee] text-muted'}`}>
                        {STATUS_LABEL[assignment.status] ?? assignment.status}
                      </span>
                      {assignment.incident ? (
                        <span className="badge bg-amber-soft text-amber">
                          <ShieldAlert size={11} /> Incidente
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Reserva {assignment.reservationCode ?? assignment.reservationId.slice(0, 8)} ·{' '}
                      {formatDate(assignment.date)} · franja {assignment.slotId}
                      {assignment.delivery ? ` · entregado ${formatDateTime(assignment.delivery.at)}` : ''}
                      {assignment.returned ? ` · devuelto ${formatDateTime(assignment.returned.at)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {assignment.status === 'reservada' ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setOpenChecklist((current) => ({
                            ...current,
                            [assignment.id]: mode === 'deliver' ? undefined : 'deliver',
                          }))
                        }
                      >
                        <PackageCheck size={13} /> Registrar entrega
                      </button>
                    ) : null}
                    {assignment.status === 'entregada' ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setOpenChecklist((current) => ({
                            ...current,
                            [assignment.id]: mode === 'return' ? undefined : 'return',
                          }))
                        }
                      >
                        <RotateCcw size={13} /> Registrar devolución
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {assignment.requiredAccessories.map((accessory) => {
                    const delivered = assignment.delivery?.checklist?.[accessory.code];
                    const returned = assignment.returned?.checklist?.[accessory.code];
                    return (
                      <span
                        key={accessory.code}
                        className={`badge ${
                          returned === false
                            ? 'bg-rose-soft text-rose'
                            : delivered
                              ? 'bg-teal-soft text-teal'
                              : 'bg-[#eef1ee] text-muted'
                        }`}
                      >
                        {accessory.label}
                      </span>
                    );
                  })}
                </div>

                {assignment.incident ? (
                  <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-[0.72rem] leading-relaxed text-amber">
                    Incidente {assignment.incident.kind}: {assignment.incident.description}
                    {assignment.incident.resolved ? ' · resuelto' : ' · pendiente'}
                  </p>
                ) : null}

                {mode ? (
                  <EquipmentChecklistForm
                    assignment={assignment}
                    mode={mode}
                    onDone={async () => {
                      setOpenChecklist((current) => ({ ...current, [assignment.id]: undefined }));
                      await loadAll();
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <CreateEquipmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await loadAll();
        }}
      />
    </div>
  );
}

function CreateEquipmentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const { notify } = useToast();
  const [type, setType] = useState<'computadora' | 'proyector' | 'pizarra'>('computadora');
  const [assetTag, setAssetTag] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType('computadora');
      setAssetTag('');
      setModel('');
      setSerial('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!assetTag.trim() || !model.trim() || !serial.trim()) {
      setError('Completá el código de inventario, el modelo y el número de serie.');
      return;
    }
    setSubmitting(true);
    try {
      await api('/equipment', {
        method: 'POST',
        body: JSON.stringify({
          type,
          assetTag: assetTag.trim(),
          model: model.trim(),
          serial: serial.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      notify(`Equipo ${assetTag.trim().toUpperCase()} dado de alta.`, 'success');
      await onCreated();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo dar de alta el equipo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Alta de equipo"
      description="Se registra con todos los accesorios obligatorios en estado disponible."
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="equipment-form" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Dar de alta'}
          </button>
        </div>
      }
    >
      <form id="equipment-form" onSubmit={submit} className="space-y-3" noValidate>
        <div>
          <label className="label" htmlFor="eq-type">
            Tipo
          </label>
          <select
            id="eq-type"
            className="select"
            value={type}
            onChange={(event) =>
              setType(event.target.value as 'computadora' | 'proyector' | 'pizarra')
            }
          >
            <option value="computadora">Notebook (funda y cargador)</option>
            <option value="proyector">Proyector (caja, HDMI, VGA y energía)</option>
            <option value="pizarra">Pizarra desplazable (sin accesorios)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="eq-tag">
            Código de inventario
          </label>
          <input
            id="eq-tag"
            className="input"
            placeholder="PC-007"
            value={assetTag}
            onChange={(event) => setAssetTag(event.target.value)}
            maxLength={40}
          />
        </div>
        <div>
          <label className="label" htmlFor="eq-model">
            Modelo
          </label>
          <input
            id="eq-model"
            className="input"
            placeholder="Lenovo ThinkPad E14"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            maxLength={80}
          />
        </div>
        <div>
          <label className="label" htmlFor="eq-serial">
            Número de serie
          </label>
          <input
            id="eq-serial"
            className="input"
            placeholder="SN-PC-007-2026"
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
            maxLength={80}
          />
        </div>
        <div>
          <label className="label" htmlFor="eq-notes">
            Notas (opcional)
          </label>
          <textarea
            id="eq-notes"
            className="textarea min-h-16"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={300}
          />
        </div>
        {error ? <p className="rounded-lg bg-rose-soft px-3 py-2 text-xs text-rose">{error}</p> : null}
      </form>
    </Modal>
  );
}
