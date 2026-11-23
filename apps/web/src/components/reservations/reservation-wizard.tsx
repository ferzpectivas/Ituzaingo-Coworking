'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Laptop,
  Minus,
  MonitorPlay,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { addDaysISO, DEFAULT_OPENING_DAYS, formatDateLong, isOpenDate, nextOpenDateISO, todayISO } from '@/lib/format';
import type {
  Availability,
  ConfigResponse,
  CreateReservationInput,
  PersonInput,
  ReservationDetail,
  Role,
} from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { Modal } from '@/components/ui/primitives';

const DOC_TYPES: PersonInput['docType'][] = ['DNI', 'PASAPORTE', 'CUIL'];

interface WizardProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (reservation: ReservationDetail) => void;
  config: ConfigResponse | null;
  defaultDate?: string;
  defaultSlot?: string;
  defaultSpace?: string;
  role: Role;
}

interface FormPerson extends PersonInput {
  key: string;
}

function emptyPerson(role: 'titular' | 'acompanante'): FormPerson {
  return {
    key: `${role}-${Math.random().toString(36).slice(2, 9)}`,
    firstName: '',
    lastName: '',
    docType: 'DNI',
    docNumber: '',
    role,
  };
}

function currentHour(): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return Number(formatted.slice(0, 2));
}

export function ReservationWizard({
  open,
  onClose,
  onCreated,
  config,
  defaultDate,
  defaultSlot,
  defaultSpace,
  role,
}: WizardProps) {
  const { user } = useAuth();
  const { notify } = useToast();
  const today = config?.today ?? todayISO();
  const openingDays = config?.settings.openingDays ?? DEFAULT_OPENING_DAYS;
  const [step, setStep] = useState(0);
  const [spaceCode, setSpaceCode] = useState('');
  const [date, setDate] = useState(nextOpenDateISO(defaultDate ?? today, openingDays));
  const [slotId, setSlotId] = useState(defaultSlot ?? config?.currentSlotId ?? 'manana');
  const [partySize, setPartySize] = useState(1);
  const [people, setPeople] = useState<FormPerson[]>([emptyPerson('titular')]);
  const [computers, setComputers] = useState(0);
  const [projectors, setProjectors] = useState(0);
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<
    Array<{ date: string; slotId: string; label: string; freeSeats: number }>
  >([]);
  const [created, setCreated] = useState<ReservationDetail | null>(null);

  const maxDate = addDaysISO(today, config?.settings.maxAdvanceDays ?? 45);

  const reset = useCallback(() => {
    setStep(0);
    setSpaceCode(defaultSpace ?? '');
    setDate(nextOpenDateISO(defaultDate ?? config?.today ?? todayISO(), openingDays));
    setSlotId(defaultSlot ?? config?.currentSlotId ?? 'manana');
    setPartySize(1);
    setPeople([
      {
        ...emptyPerson('titular'),
        firstName: user?.person.firstName ?? '',
        lastName: user?.person.lastName ?? '',
      },
    ]);
    setComputers(0);
    setProjectors(0);
    setNotes('');
    setErrors({});
    setSubmitError(null);
    setAlternatives([]);
    setCreated(null);
  }, [config, defaultDate, defaultSlot, defaultSpace, openingDays, user]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Sincroniza la cantidad de personas al cambiar el tamaño del grupo.
  useEffect(() => {
    setPeople((current) => {
      const next = [...current];
      if (next.length < partySize) {
        while (next.length < partySize) next.push(emptyPerson('acompanante'));
      } else if (next.length > partySize) {
        next.splice(partySize);
      }
      if (next[0]) next[0].role = 'titular';
      for (let i = 1; i < next.length; i += 1) next[i].role = 'acompanante';
      return next;
    });
  }, [partySize]);

  const loadAvailability = useCallback(
    async (signal?: AbortSignal) => {
      if (!open) return;
      setLoadingAvailability(true);
      setAvailabilityError(null);
      try {
        const result = await api<Availability>(
          `/availability?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slotId)}&partySize=${partySize}`,
          { signal },
        );
        setAvailability(result);
      } catch (cause) {
        if ((cause as Error)?.name === 'AbortError') return;
        setAvailabilityError(
          cause instanceof ApiError ? cause.message : 'No se pudo consultar la disponibilidad.',
        );
      } finally {
        setLoadingAvailability(false);
      }
    },
    [date, slotId, partySize, open],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadAvailability(controller.signal);
    return () => controller.abort();
  }, [open, loadAvailability]);

  const selectedSpace = useMemo(
    () => availability?.spaces.find((space) => space.code === spaceCode) ?? null,
    [availability, spaceCode],
  );

  const maxParty = useMemo(() => {
    if (!selectedSpace) return 12;
    if (selectedSpace.code === 'sala-reuniones') {
      return selectedSpace.occupiedSeats > 0 ? 0 : selectedSpace.capacity;
    }
    return Math.max(0, Math.min(selectedSpace.capacity, selectedSpace.freeSeats));
  }, [selectedSpace]);

  useEffect(() => {
    if (spaceCode && maxParty > 0 && partySize > maxParty) setPartySize(maxParty);
    if (spaceCode && maxParty === 0 && partySize !== 1) setPartySize(1);
  }, [spaceCode, maxParty, partySize]);

  const equipmentAvailability = useMemo(() => {
    const map = new Map<string, { available: number; total: number }>();
    for (const item of availability?.equipment ?? []) {
      map.set(item.type, { available: item.available, total: item.total });
    }
    return map;
  }, [availability]);

  const computersMax = Math.min(equipmentAvailability.get('computadora')?.available ?? 0, Math.max(0, partySize));
  const projectorsMax = equipmentAvailability.get('proyector')?.available ?? 0;

  useEffect(() => {
    if (computers > computersMax) setComputers(computersMax);
    if (projectors > projectorsMax) setProjectors(projectorsMax);
  }, [computers, projectors, computersMax, projectorsMax]);

  const slotEnded = (slotStart: string, slotEnd: string): boolean => {
    if (date !== today) return false;
    const now = new Date();
    const hour = currentHour();
    const endHour = Number(slotEnd.slice(0, 2));
    const startHour = Number(slotStart.slice(0, 2));
    if (hour >= endHour) return true;
    if (hour >= startHour) return true;
    return now.getFullYear() < 2000;
  };

  function validateStep1(): boolean {
    const next: Record<string, string> = {};
    if (!spaceCode) next.space = 'Elegí un ambiente.';
    if (!date) next.date = 'Elegí una fecha.';
    if (date < today) next.date = 'La fecha no puede ser anterior a hoy.';
    if (date > maxDate) next.date = `La fecha máxima es ${formatDateLong(maxDate)}.`;
    if (date && !isOpenDate(date, openingDays)) {
      next.date = 'El espacio está cerrado los fines de semana. Elegí un día de lunes a viernes.';
    }
    if (!slotId) next.slot = 'Elegí una franja.';
    if (spaceCode && maxParty === 0) {
      next.party =
        spaceCode === 'sala-reuniones'
          ? 'La sala se reserva completa y ya tiene reservas en esta franja.'
          : 'No hay puestos suficientes en esta franja.';
    }
    if (partySize < 1) next.party = 'La reserva necesita al menos una persona.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2(): boolean {
    const next: Record<string, string> = {};
    const seen = new Set<string>();
    people.forEach((person, index) => {
      // El titular socio se identifica con su cuenta: no se le pide documento.
      const holderFromAccount = index === 0 && role === 'socio';
      if (person.firstName.trim().length < 2) next[`firstName-${index}`] = 'Ingresá el nombre.';
      if (person.lastName.trim().length < 2) next[`lastName-${index}`] = 'Ingresá el apellido.';
      const doc = (person.docNumber ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
      if (!holderFromAccount) {
        if (person.docType === 'DNI' && !/^\d{7,9}$/.test(doc)) {
          next[`doc-${index}`] = 'El DNI debe tener entre 7 y 9 dígitos.';
        } else if (person.docType === 'CUIL' && !/^\d{11}$/.test(doc)) {
          next[`doc-${index}`] = 'El CUIL debe tener 11 dígitos.';
        } else if (person.docType === 'PASAPORTE' && !/^[A-Z0-9]{5,15}$/.test(doc)) {
          next[`doc-${index}`] = 'El pasaporte no es válido.';
        }
        if (seen.has(doc)) next[`doc-${index}`] = 'Esta persona ya está en la reserva.';
        seen.add(doc);
      }
    });
    if (people.length !== partySize) next.people = 'Completá todas las personas de la reserva.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setErrors({});
    setStep((current) => Math.min(2, current + 1));
  }

  function updatePerson(index: number, patch: Partial<FormPerson>) {
    setPeople((current) => current.map((person, i) => (i === index ? { ...person, ...patch } : person)));
  }

  async function submit() {
    if (!validateStep1() || !validateStep2()) {
      setStep(0);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setAlternatives([]);
    const payload: CreateReservationInput = {
      spaceCode,
      date,
      slotId,
      partySize,
      people: people.map((person, index) => ({
        firstName: person.firstName.trim(),
        lastName: person.lastName.trim(),
        docType: person.docType,
        docNumber:
          index === 0 && role === 'socio'
            ? undefined
            : (person.docNumber ?? '').trim(),
        role: index === 0 ? 'titular' : 'acompanante',
      })),
      equipment: { computers, projectors },
      notes: notes.trim() || undefined,
    };
    try {
      const key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `res-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const reservation = await api<ReservationDetail>('/reservations', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'idempotency-key': key },
        retry: false,
      });
      setCreated(reservation);
      notify(`Reserva ${reservation.code} confirmada.`, 'success');
      onCreated?.(reservation);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setSubmitError(cause.message);
        const meta = cause.meta as
          | { alternatives?: Array<{ date: string; slotId: string; label: string; freeSeats: number }> }
          | undefined;
        if (meta?.alternatives?.length) setAlternatives(meta.alternatives);
      } else {
        setSubmitError('No pudimos crear la reserva. Intentá nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    if (submitting) return;
    onClose();
  }

  const stepLabels = ['Espacio y franja', 'Personas', 'Equipamiento'];

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={created ? 'Reserva confirmada' : 'Nueva reserva'}
      description={
        created
          ? 'Guardá el código para identificarte en la recepción.'
          : 'Completá los tres pasos. Podés volver atrás antes de confirmar.'
      }
      footer={
        created ? (
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={close}>
              Cerrar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={close}>
              <CheckCircle2 size={15} /> Listo
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => (step === 0 ? close() : setStep((current) => current - 1))}
              disabled={submitting}
            >
              <ArrowLeft size={15} />
              {step === 0 ? 'Cancelar' : 'Atrás'}
            </button>
            {step < 2 ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={goNext}>
                Continuar <ArrowRight size={15} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={submitting}>
                {submitting ? 'Confirmando…' : 'Confirmar reserva'}
                {!submitting ? <Check size={15} /> : null}
              </button>
            )}
          </div>
        )
      }
    >
      {created ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-teal-soft/70 p-5 text-center">
            <CheckCircle2 className="mx-auto text-teal" size={34} />
            <p className="mt-2 font-serif text-2xl text-ink">{created.code}</p>
            <p className="mt-1 text-sm text-muted">
              {created.space.name} · {formatDateLong(created.date)} · {created.slot.label}
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3">
              <dt className="text-[0.68rem] uppercase tracking-wide text-muted">Titular</dt>
              <dd className="text-sm font-semibold text-ink">
                {created.holder.firstName} {created.holder.lastName}
              </dd>
            </div>
            <div className="rounded-xl border border-line p-3">
              <dt className="text-[0.68rem] uppercase tracking-wide text-muted">Personas</dt>
              <dd className="text-sm font-semibold text-ink">
                {created.partySize} ({created.companionsCount} acompañantes)
              </dd>
            </div>
            <div className="rounded-xl border border-line p-3">
              <dt className="text-[0.68rem] uppercase tracking-wide text-muted">Puestos asignados</dt>
              <dd className="text-sm font-semibold text-ink">
                {created.seats.map((seat) => seat.furnitureLabel).join(' · ') || 'Automático'}
              </dd>
            </div>
            <div className="rounded-xl border border-line p-3">
              <dt className="text-[0.68rem] uppercase tracking-wide text-muted">Equipamiento</dt>
              <dd className="text-sm font-semibold text-ink">
                {created.equipment.length
                  ? created.equipment.map((item) => item.assetTag).join(' · ')
                  : 'Sin equipamiento'}
              </dd>
            </div>
          </dl>
          <p className="rounded-xl bg-gold-soft/70 px-3.5 py-3 text-xs leading-relaxed text-ink/80">
            Presentate en la recepción con tu DNI. El personal administrativo registrará el ingreso
            y, si pediste equipamiento, revisará el checklist de entrega.
          </p>
        </div>
      ) : (
        <div>
          {/* Stepper */}
          <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Pasos de la reserva">
            {stepLabels.map((label, index) => {
              const active = index === step;
              const complete = index < step;
              return (
                <li key={label} className="flex items-center gap-2">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      active
                        ? 'bg-teal text-white'
                        : complete
                          ? 'bg-teal-soft text-teal'
                          : 'bg-[#eef1ee] text-muted'
                    }`}
                    aria-current={active ? 'step' : undefined}
                  >
                    {complete ? <Check size={13} /> : index + 1}
                  </span>
                  <span
                    className={`hidden text-[0.7rem] font-semibold uppercase tracking-wide sm:block ${
                      active ? 'text-teal' : 'text-muted'
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          {step === 0 ? (
            <div className="space-y-5">
              <fieldset>
                <legend className="label">1. Ambiente</legend>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {(availability?.spaces ?? []).map((space) => {
                    const active = spaceCode === space.code;
                    const unavailable = space.code === 'sala-reuniones' ? space.occupiedSeats > 0 : space.freeSeats === 0;
                    return (
                      <button
                        key={space.code}
                        type="button"
                        disabled={unavailable}
                        onClick={() => {
                          setSpaceCode(space.code);
                          setErrors({});
                          if (space.code === 'sala-reuniones' && space.occupiedSeats === 0) {
                            setPartySize(space.capacity);
                          }
                        }}
                        className={`rounded-xl border p-3 text-left transition ${
                          active
                            ? 'border-teal bg-teal-soft/60 ring-2 ring-teal/20'
                            : 'border-line bg-white hover:border-teal/40'
                        } ${unavailable ? 'cursor-not-allowed opacity-50' : ''}`}
                        aria-pressed={active}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-ink">{space.name}</span>
                          <span className="badge bg-white text-muted">{space.capacity}</span>
                        </span>
                        <span className="mt-1 block text-[0.7rem] text-muted">
                          {space.code === 'sala-reuniones'
                            ? space.occupiedSeats > 0
                              ? 'Ocupada en esta franja'
                              : 'Se reserva completa'
                            : `${space.freeSeats} puestos libres`}
                        </span>
                      </button>
                    );
                  })}
                  {!availability && loadingAvailability ? (
                    <div className="skeleton h-20 sm:col-span-3" />
                  ) : null}
                  {availability?.closed ? (
                    <p className="text-sm text-muted sm:col-span-3">
                      El espacio está cerrado ese día. Elegí un día de lunes a viernes.
                    </p>
                  ) : null}
                  {availability && !availability.closed && availability.spaces.length === 0 ? (
                    <p className="text-sm text-muted">No hay ambientes disponibles.</p>
                  ) : null}
                </div>
                {errors.space ? <p className="mt-1 text-xs text-rose">{errors.space}</p> : null}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="wizard-date" className="label">
                    2. Fecha
                  </label>
                  <input
                    id="wizard-date"
                    type="date"
                    className="input"
                    value={date}
                    min={today}
                    max={maxDate}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDate(value);
                      setSpaceCode('');
                      setErrors(
                        value && !isOpenDate(value, openingDays)
                          ? { date: 'El espacio está cerrado los fines de semana. Elegí un día de lunes a viernes.' }
                          : {},
                      );
                    }}
                  />
                  {errors.date ? <p className="mt-1 text-xs text-rose">{errors.date}</p> : null}
                </div>
                <div>
                  <span className="label">3. Franja horaria</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(config?.settings.slots ?? []).map((slot) => {
                      const active = slotId === slot.id;
                      const disabled = slotEnded(slot.start, slot.end);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setSlotId(slot.id);
                            setSpaceCode('');
                            setErrors({});
                          }}
                          className={`rounded-lg border px-1 py-2 text-center text-[0.72rem] font-semibold transition ${
                            active
                              ? 'border-teal bg-teal text-white'
                              : 'border-line bg-white text-muted hover:border-teal/40'
                          } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                          aria-pressed={active}
                        >
                          {slot.start}
                          <span className="block text-[0.62rem] font-normal opacity-80">a {slot.end}</span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.slot ? <p className="mt-1 text-xs text-rose">{errors.slot}</p> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-[#fbfcfa] px-3.5 py-3">
                <div>
                  <span className="label mb-0">4. Cantidad de personas</span>
                  <p className="text-xs text-muted">
                    Titular incluido. {selectedSpace ? `Máximo ${maxParty} en ${selectedSpace.name}.` : 'Elegí un ambiente.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPartySize((current) => Math.max(1, current - 1))}
                    className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-muted hover:border-teal/40 hover:text-teal"
                    aria-label="Quitar una persona"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center font-serif text-xl text-ink" aria-live="polite">
                    {partySize}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPartySize((current) => Math.min(Math.max(1, maxParty), current + 1))}
                    disabled={!spaceCode || partySize >= maxParty}
                    className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-muted hover:border-teal/40 hover:text-teal disabled:opacity-40"
                    aria-label="Agregar una persona"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              {errors.party ? <p className="text-xs text-rose">{errors.party}</p> : null}
              {availabilityError ? (
                <p className="rounded-lg bg-rose-soft px-3 py-2 text-xs text-rose">{availabilityError}</p>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">Personas de la reserva</p>
                  <p className="text-xs text-muted">
                    {partySize} {partySize === 1 ? 'persona' : 'personas'} · el titular es quien reserva.
                  </p>
                </div>
                {user && role === 'socio' ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      updatePerson(0, {
                        firstName: user.person.firstName,
                        lastName: user.person.lastName,
                        docType: 'DNI',
                      })
                    }
                  >
                    Usar mis datos
                  </button>
                ) : null}
              </div>

              {people.map((person, index) => {
                const holderFromAccount = index === 0 && role === 'socio';
                return (
                <div key={person.key} className="rounded-xl border border-line bg-white p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal">
                      {index === 0 ? <Users size={13} /> : null}
                      {index === 0 ? 'Titular' : `Acompañante ${index}`}
                    </span>
                    {index > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPeople((current) => current.filter((_, i) => i !== index));
                          setPartySize((current) => Math.max(1, current - 1));
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-semibold text-rose hover:bg-rose-soft"
                      >
                        <Trash2 size={12} /> Quitar
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor={`fn-${index}`}>
                        Nombre
                      </label>
                      <input
                        id={`fn-${index}`}
                        className={holderFromAccount ? 'input bg-[#f7f8f6] text-muted' : 'input'}
                        value={person.firstName}
                        autoComplete="given-name"
                        readOnly={holderFromAccount}
                        onChange={(event) => updatePerson(index, { firstName: event.target.value })}
                        aria-invalid={Boolean(errors[`firstName-${index}`])}
                      />
                      {errors[`firstName-${index}`] ? (
                        <p className="mt-1 text-xs text-rose">{errors[`firstName-${index}`]}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className="label" htmlFor={`ln-${index}`}>
                        Apellido
                      </label>
                      <input
                        id={`ln-${index}`}
                        className={holderFromAccount ? 'input bg-[#f7f8f6] text-muted' : 'input'}
                        value={person.lastName}
                        autoComplete="family-name"
                        readOnly={holderFromAccount}
                        onChange={(event) => updatePerson(index, { lastName: event.target.value })}
                        aria-invalid={Boolean(errors[`lastName-${index}`])}
                      />
                      {errors[`lastName-${index}`] ? (
                        <p className="mt-1 text-xs text-rose">{errors[`lastName-${index}`]}</p>
                      ) : null}
                    </div>
                    {holderFromAccount ? (
                      <div className="rounded-lg border border-teal/20 bg-teal-soft/50 px-3 py-2.5 sm:col-span-2">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-teal">
                          Documento de la cuenta
                        </p>
                        <p className="text-sm font-semibold text-ink">
                          DNI ****{user?.person.docLast4 ?? '—'}
                        </p>
                        <p className="text-[0.68rem] leading-relaxed text-muted">
                          El titular queda identificado con la cuenta que inició sesión. Los
                          acompañantes sí deben informar su documento.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="label" htmlFor={`dt-${index}`}>
                            Tipo de documento
                          </label>
                          <select
                            id={`dt-${index}`}
                            className="select"
                            value={person.docType}
                            onChange={(event) =>
                              updatePerson(index, { docType: event.target.value as PersonInput['docType'] })
                            }
                          >
                            {DOC_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label" htmlFor={`dn-${index}`}>
                            Número de documento
                          </label>
                          <input
                            id={`dn-${index}`}
                            className="input"
                            inputMode={person.docType === 'DNI' ? 'numeric' : 'text'}
                            placeholder={person.docType === 'DNI' ? '30123456' : 'Número completo'}
                            value={person.docNumber ?? ''}
                            onChange={(event) => updatePerson(index, { docNumber: event.target.value })}
                            aria-invalid={Boolean(errors[`doc-${index}`])}
                            autoComplete="off"
                          />
                          {errors[`doc-${index}`] ? (
                            <p className="mt-1 text-xs text-rose">{errors[`doc-${index}`]}</p>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                );
              })}

              {people.length < 12 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (people.length >= maxParty) {
                      notify(`El ambiente admite hasta ${maxParty} personas.`, 'info');
                      return;
                    }
                    setPeople((current) => [...current, emptyPerson('acompanante')]);
                    setPartySize((current) => current + 1);
                  }}
                  className="btn btn-outline btn-sm"
                >
                  <Plus size={14} /> Agregar acompañante
                </button>
              ) : null}

              {errors.people ? <p className="text-xs text-rose">{errors.people}</p> : null}
              <p className="text-[0.7rem] leading-relaxed text-muted">
                Los documentos se guardan cifrados y sólo se muestran los últimos cuatro dígitos en el
                mapa y en los listados.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-ink">Equipamiento opcional</p>
                <p className="text-xs text-muted">
                  La disponibilidad corresponde a la franja seleccionada. El checklist se completa en
                  la entrega.
                </p>
              </div>

              {(['computadora', 'proyector'] as const).map((type) => {
                const info = equipmentAvailability.get(type);
                const value = type === 'computadora' ? computers : projectors;
                const max = type === 'computadora' ? computersMax : projectorsMax;
                const setValue = type === 'computadora' ? setComputers : setProjectors;
                const available = info?.available ?? 0;
                return (
                  <div key={type} className="rounded-xl border border-line bg-white p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-lg ${
                            type === 'computadora' ? 'bg-teal-soft text-teal' : 'bg-blue-soft text-blue'
                          }`}
                        >
                          {type === 'computadora' ? <Laptop size={17} /> : <MonitorPlay size={17} />}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {type === 'computadora' ? 'Computadora' : 'Proyector'}
                          </p>
                          <p className="text-[0.7rem] text-muted">
                            {available} de {info?.total ?? 0} disponibles
                            {type === 'computadora' ? ' · funda y cargador' : ' · caja, HDMI, VGA y energía'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setValue(Math.max(0, value - 1))}
                          disabled={value <= 0}
                          className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-muted hover:border-teal/40 disabled:opacity-40"
                          aria-label={`Quitar ${type}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-serif text-lg text-ink" aria-live="polite">
                          {value}
                        </span>
                        <button
                          type="button"
                          onClick={() => setValue(Math.min(max, value + 1))}
                          disabled={value >= max}
                          className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-muted hover:border-teal/40 disabled:opacity-40"
                          aria-label={`Agregar ${type}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    {max === 0 ? (
                      <p className="mt-2 rounded-lg bg-amber-soft px-2.5 py-1.5 text-[0.68rem] text-amber">
                        No hay {type === 'computadora' ? 'computadoras' : 'proyectores'} disponibles en
                        esta franja.
                      </p>
                    ) : null}
                  </div>
                );
              })}

              <div>
                <label htmlFor="wizard-notes" className="label">
                  Notas para la recepción (opcional)
                </label>
                <textarea
                  id="wizard-notes"
                  className="textarea min-h-20"
                  maxLength={500}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Por ejemplo: necesitamos el proyector para una presentación."
                />
              </div>

              <div className="rounded-xl border border-teal/20 bg-teal-soft/50 p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-teal">Resumen</p>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3 sm:block">
                    <dt className="text-muted">Ambiente</dt>
                    <dd className="font-semibold text-ink">{selectedSpace?.name ?? spaceCode}</dd>
                  </div>
                  <div className="flex justify-between gap-3 sm:block">
                    <dt className="text-muted">Fecha y franja</dt>
                    <dd className="font-semibold text-ink">
                      {formatDateLong(date)} · {config?.settings.slots.find((slot) => slot.id === slotId)?.label}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 sm:block">
                    <dt className="text-muted">Personas</dt>
                    <dd className="font-semibold text-ink">
                      {partySize} · Titular {people[0]?.firstName} {people[0]?.lastName}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 sm:block">
                    <dt className="text-muted">Equipamiento</dt>
                    <dd className="font-semibold text-ink">
                      {[computers ? `${computers} PC` : '', projectors ? `${projectors} proyector` : '']
                        .filter(Boolean)
                        .join(' · ') || 'Sin equipamiento'}
                    </dd>
                  </div>
                </dl>
              </div>

              {submitError ? (
                <div role="alert" className="rounded-xl border border-rose/25 bg-rose-soft p-3.5">
                  <p className="text-sm font-semibold text-rose">{submitError}</p>
                  {alternatives.length ? (
                    <div className="mt-2">
                      <p className="text-xs text-ink/70">Alternativas con disponibilidad:</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {alternatives.map((alternative) => (
                          <button
                            key={`${alternative.date}-${alternative.slotId}`}
                            type="button"
                            className="rounded-full border border-rose/30 bg-white px-3 py-1 text-xs font-semibold text-rose"
                            onClick={() => {
                              setDate(alternative.date);
                              setSlotId(alternative.slotId);
                              setSpaceCode('');
                              setStep(0);
                              setSubmitError(null);
                              setAlternatives([]);
                            }}
                          >
                            {alternative.date} · {alternative.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-muted">
                <Clock3 size={13} className="mt-0.5 shrink-0" />
                Podés cancelar hasta {config?.settings.cancellationHours ?? 2} horas antes del inicio.
                Si pediste equipamiento, la devolución debe registrarse antes de finalizar la reserva.
              </p>
            </div>
          ) : null}

          {loadingAvailability && step === 0 ? (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted" role="status">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal/25 border-t-teal" />
              Actualizando disponibilidad…
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
