'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, TriangleAlert } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { EquipmentAssignment, ReservationEquipment } from '@/lib/types';
import { useToast } from '@/components/providers/toast-provider';

type AssignmentLike = Pick<
  EquipmentAssignment,
  'id' | 'assetTag' | 'type' | 'status' | 'requiredAccessories' | 'delivery' | 'returned' | 'incident'
>;

export function EquipmentChecklistForm({
  assignment,
  mode,
  onDone,
}: {
  assignment: AssignmentLike | ReservationEquipment;
  mode: 'deliver' | 'return';
  onDone?: () => void;
}) {
  const { notify } = useToast();
  const required = assignment.requiredAccessories;
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(required.map((item) => [item.code, true])),
  );
  const [observations, setObservations] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentKind, setIncidentKind] = useState<'faltante' | 'daño'>('faltante');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = useMemo(
    () => required.filter((item) => !values[item.code]).map((item) => item.code),
    [required, values],
  );

  const assignmentId = 'assignmentId' in assignment ? assignment.assignmentId : assignment.id;

  async function submit() {
    setError(null);
    if (mode === 'deliver' && missing.length > 0) {
      setError('Todos los accesorios deben estar presentes para entregar el equipo.');
      return;
    }
    if (mode === 'return' && missing.length > 0 && incidentDescription.trim().length < 4) {
      setError('Describí el incidente por los accesorios faltantes.');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        checklist: { ...values, observations: observations.trim() || undefined },
      };
      if (mode === 'return' && missing.length > 0) {
        body.incident = {
          kind: incidentKind,
          accessories: missing,
          description: incidentDescription.trim(),
        };
      }
      await api(`/equipment/assignments/${assignmentId}/${mode === 'deliver' ? 'deliver' : 'return'}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      notify(
        mode === 'deliver'
          ? `Entrega registrada para ${assignment.assetTag}.`
          : `Devolución registrada para ${assignment.assetTag}.`,
        'success',
      );
      onDone?.();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo registrar el checklist.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-[#fbfcfa] p-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">
        Checklist de {mode === 'deliver' ? 'entrega' : 'devolución'}
      </p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {required.map((item) => (
          <li key={item.code}>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={values[item.code] ?? false}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [item.code]: event.target.checked }))
                }
                className="h-4 w-4 rounded border-line text-teal focus:ring-teal"
              />
              {item.label}
            </label>
          </li>
        ))}
      </ul>

      {mode === 'return' && missing.length > 0 ? (
        <div className="mt-2.5 space-y-2 rounded-lg border border-amber/25 bg-amber-soft p-2.5">
          <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-amber">
            <TriangleAlert size={13} /> Faltan accesorios: {missing.join(', ')}
          </p>
          <div>
            <label className="label" htmlFor={`incident-kind-${assignmentId}`}>
              Tipo de incidente
            </label>
            <select
              id={`incident-kind-${assignmentId}`}
              className="select"
              value={incidentKind}
              onChange={(event) => setIncidentKind(event.target.value as 'faltante' | 'daño')}
            >
              <option value="faltante">Faltante</option>
              <option value="daño">Daño</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`incident-desc-${assignmentId}`}>
              Descripción
            </label>
            <input
              id={`incident-desc-${assignmentId}`}
              className="input"
              value={incidentDescription}
              onChange={(event) => setIncidentDescription(event.target.value)}
              placeholder="Detallá qué falta o está dañado"
            />
          </div>
        </div>
      ) : null}

      <div className="mt-2">
        <label className="label" htmlFor={`observations-${assignmentId}`}>
          Observaciones (opcional)
        </label>
        <input
          id={`observations-${assignmentId}`}
          className="input"
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          placeholder="Estado general, detalles de entrega…"
        />
      </div>

      {error ? <p className="mt-2 text-xs text-rose">{error}</p> : null}

      <button
        type="button"
        className="btn btn-primary btn-sm mt-2"
        onClick={submit}
        disabled={submitting}
      >
        {mode === 'deliver' ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
        {submitting
          ? 'Guardando…'
          : mode === 'deliver'
            ? 'Confirmar entrega'
            : 'Confirmar devolución'}
      </button>
    </div>
  );
}
