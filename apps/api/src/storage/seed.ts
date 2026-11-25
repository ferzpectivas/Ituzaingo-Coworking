import FLOORPLAN_JSON from '../floorplan/floorplan.generated.json';
import type { FloorplanManifest } from '../floorplan/types';
import { addDays, isoFor, todayISO } from '../common/time';
import { hashDocument, hashPasswordSync, lastFour, randomId, seal } from '../common/crypto';
import type {
  AccessoryCode,
  AccessoryChecklist,
  AssignmentStatus,
  ChecklistRecord,
  DbState,
  EquipmentAssignmentRecord,
  EquipmentItemRecord,
  EquipmentType,
  PersonRecord,
  ReservationPerson,
  ReservationRecord,
  ReservationStatus,
  SettingsRecord,
  SlotConfig,
  UserRecord,
} from './types';
import { REQUIRED_ACCESSORIES } from './types';

const FLOORPLAN = FLOORPLAN_JSON as unknown as FloorplanManifest;

const SETTINGS: SettingsRecord = {
  spaceName: 'Espacio de Coworking',
  organization: 'Municipalidad de Ituzaingó',
  address: 'Ituzaingó, Buenos Aires',
  timezone: 'America/Argentina/Buenos_Aires',
  slots: [
    { id: 'manana', label: '09:00 a 13:00', start: '09:00', end: '13:00' },
    { id: 'tarde', label: '14:00 a 18:00', start: '14:00', end: '18:00' },
    { id: 'noche', label: '18:00 a 22:00', start: '18:00', end: '22:00' },
  ],
  maxAdvanceDays: 45,
  cancellationHours: 2,
  checkinGraceMinutes: 30,
};

const PERSON_SEED: Array<{
  id: string;
  firstName: string;
  lastName: string;
  doc: string;
  email?: string;
  phone?: string;
}> = [
  { id: 'per_juan', firstName: 'Juan', lastName: 'Pérez', doc: '30123456', email: 'juan@example.com' },
  { id: 'per_maria', firstName: 'María', lastName: 'Gómez', doc: '28555444', email: 'maria@example.com' },
  { id: 'per_lucas', firstName: 'Lucas', lastName: 'Fernández', doc: '33444555' },
  { id: 'per_ana', firstName: 'Ana', lastName: 'Rodríguez', doc: '31222333' },
  { id: 'per_carla', firstName: 'Carla', lastName: 'Medina', doc: '35666777' },
  { id: 'per_diego', firstName: 'Diego', lastName: 'Sosa', doc: '29888777' },
  { id: 'per_lucia', firstName: 'Lucía', lastName: 'Benítez', doc: '36777888' },
  { id: 'per_martin', firstName: 'Martín', lastName: 'Aguirre', doc: '27666555' },
  { id: 'per_carolina', firstName: 'Carolina', lastName: 'Ruiz', doc: '32444555' },
  { id: 'per_pablo', firstName: 'Pablo', lastName: 'Ferreyra', doc: '34111222' },
  { id: 'per_sofia', firstName: 'Sofía', lastName: 'Cabrera', doc: '38888999' },
];

const USER_SEED: Array<{ id: string; email: string; password: string; role: UserRecord['role']; personId: string }> = [
  { id: 'usr_socio', email: 'socio@coworking.gob.ar', password: 'Socio1234!', role: 'socio', personId: 'per_juan' },
  { id: 'usr_admin', email: 'admin@coworking.gob.ar', password: 'Admin1234!', role: 'administrador', personId: 'per_carolina' },
  { id: 'usr_director', email: 'director@coworking.gob.ar', password: 'Director1234!', role: 'director', personId: 'per_martin' },
];

function allAccessories(): Record<AccessoryCode, boolean> {
  return {
    funda: true,
    cargador: true,
    caja: true,
    hdmi: true,
    vga: true,
    cable_energia: true,
  };
}

function buildGear(now: string): EquipmentItemRecord[] {
  const items: EquipmentItemRecord[] = [];

  // REQ-03: inventario real del espacio: 2 notebooks y 1 proyector.
  const notebooks = [
    { assetTag: 'NB-001', model: 'Lenovo ThinkPad E14' },
    { assetTag: 'NB-002', model: 'Dell Latitude 3440' },
  ];
  notebooks.forEach(({ assetTag, model }, i) => {
    items.push({
      id: `eq_nb_${String(i + 1).padStart(3, '0')}`,
      assetTag,
      type: 'computadora',
      model,
      serial: `SN-${assetTag}-2025`,
      status: 'disponible',
      accessories: allAccessories(),
      notes: 'Notebook con funda y cargador. Checklist obligatorio en cada entrega.',
      createdAt: now,
      updatedAt: now,
    });
  });

  items.push({
    id: 'eq_pj_001',
    assetTag: 'PJ-001',
    type: 'proyector',
    model: 'Epson PowerLite X49',
    serial: 'SN-PJ-001-2025',
    status: 'disponible',
    accessories: allAccessories(),
    notes: 'Incluye caja, HDMI, VGA y cable de energía.',
    createdAt: now,
    updatedAt: now,
  });

  // REQ-03: pizarra desplazable reservable, sin accesorios obligatorios.
  items.push({
    id: 'eq_pz_001',
    assetTag: 'PZ-001',
    type: 'pizarra',
    model: 'Pizarra desplazable 90 x 120 cm',
    serial: 'SN-PZ-001-2025',
    status: 'disponible',
    accessories: {
      funda: false,
      cargador: false,
      caja: false,
      hdmi: false,
      vga: false,
      cable_energia: false,
    },
    notes: 'Pizarra desplazable para el Aula de Capacitaciones.',
    createdAt: now,
    updatedAt: now,
  });

  return items;
}

function slotById(slotId: string): SlotConfig {
  return SETTINGS.slots.find((s) => s.id === slotId) ?? SETTINGS.slots[0];
}

function statusFor(date: string, slotId: string): ReservationStatus {
  const today = todayISO();
  if (date < today) return 'finalizada';
  if (date > today) return 'confirmada';
  const slot = slotById(slotId);
  const start = Date.parse(isoFor(date, slot.start));
  const end = Date.parse(isoFor(date, slot.end));
  const now = Date.now();
  if (now > end) return 'finalizada';
  if (now >= start) return 'en_curso';
  return 'confirmada';
}

function allocateSeatIds(
  spaceCode: string,
  date: string,
  slotId: string,
  partySize: number,
  usedSeats: Set<string>,
): string[] | null {
  const key = (seatId: string) => `${date}|${slotId}|${seatId}`;
  const units = FLOORPLAN.furniture.filter((f) => f.spaceCode === spaceCode);
  if (!units.length) return null;

  if (spaceCode === 'sala-reuniones') {
    const seats = units.flatMap((u) => u.seats.map((s) => s.id));
    if (partySize > seats.length) return null;
    if (seats.some((id) => usedSeats.has(key(id)))) return null;
    return seats;
  }

  const candidates = units
    .map((unit) => ({
      unit,
      free: unit.seats.filter((s) => !usedSeats.has(key(s.id))).map((s) => s.id),
    }))
    .filter((c) => c.free.length > 0)
    .sort((a, b) => b.free.length - a.free.length || a.unit.code.localeCompare(b.unit.code));

  const chosen: string[] = [];
  const fitting = candidates.find((c) => c.free.length >= partySize);
  if (fitting) {
    chosen.push(...fitting.free.slice(0, partySize));
  } else {
    for (const c of candidates) {
      if (chosen.length >= partySize) break;
      chosen.push(...c.free.slice(0, partySize - chosen.length));
    }
  }
  return chosen.length === partySize ? chosen : null;
}

export function buildSeedState(): DbState {
  const now = new Date().toISOString();
  const today = todayISO();

  const persons: PersonRecord[] = PERSON_SEED.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    docType: 'DNI',
    docHash: hashDocument('DNI', p.doc),
    docLast4: lastFour(p.doc),
    docSealed: seal(p.doc),
    email: p.email,
    phone: p.phone,
    createdAt: now,
    updatedAt: now,
  }));

  const users: UserRecord[] = USER_SEED.map((u) => ({
    id: u.id,
    email: u.email,
    passwordHash: hashPasswordSync(u.password),
    role: u.role,
    personId: u.personId,
    active: true,
    createdAt: now,
  }));

  const gear = buildGear(now);
  const reservations: ReservationRecord[] = [];
  const checkouts: EquipmentAssignmentRecord[] = [];
  const audit: DbState['audit'] = [];
  const usedSeats = new Set<string>();
  const usedEquipment = new Set<string>();
  const seq = { CW: 0, SA: 0, SR: 0 };

  const personById = new Map(persons.map((p) => [p.id, p]));

  function personFor(record: PersonRecord): ReservationPerson {
    return {
      personId: record.id,
      firstName: record.firstName,
      lastName: record.lastName,
      docType: record.docType,
      docHash: record.docHash,
      docLast4: record.docLast4,
      role: 'acompanante',
    };
  }

  function makeChecklist(required: AccessoryCode[], allTrue = true): AccessoryChecklist {
    const out: AccessoryChecklist = {};
    for (const code of required) out[code] = allTrue;
    return out;
  }

  function makeChecklistRecord(
    required: AccessoryCode[],
    at: string,
    byUserId: string,
  ): ChecklistRecord {
    return {
      at,
      byUserId,
      checklist: makeChecklist(required),
      allOk: true,
    };
  }

  function equipmentAssignments(
    reservation: ReservationRecord,
    wanted: Array<{ type: EquipmentType; count: number }>,
  ): void {
    const ids: string[] = [];
    for (const want of wanted) {
      for (let n = 0; n < want.count; n += 1) {
        const keyBase = `${reservation.date}|${reservation.slotId}`;
        const item = gear.find(
          (g) =>
            g.type === want.type &&
            g.status !== 'mantenimiento' &&
            !usedEquipment.has(`${keyBase}|${g.id}`),
        );
        if (!item) continue;
        usedEquipment.add(`${keyBase}|${item.id}`);
        const required = REQUIRED_ACCESSORIES[item.type];
        const status: AssignmentStatus =
          reservation.status === 'finalizada'
            ? 'devuelta'
            : reservation.status === 'en_curso'
              ? 'entregada'
              : reservation.status === 'confirmada'
                ? 'reservada'
                : 'cancelada';
        const delivery =
          status === 'entregada' || status === 'devuelta'
            ? makeChecklistRecord(required, reservation.startsAt, 'usr_admin')
            : undefined;
        const returned =
          status === 'devuelta'
            ? makeChecklistRecord(required, reservation.endsAt, 'usr_admin')
            : undefined;
        const assignment: EquipmentAssignmentRecord = {
          id: `asg_${reservation.id}_${String(ids.length + 1)}`,
          reservationId: reservation.id,
          itemId: item.id,
          type: item.type,
          assetTag: item.assetTag,
          status,
          date: reservation.date,
          slotId: reservation.slotId,
          startsAt: reservation.startsAt,
          endsAt: reservation.endsAt,
          delivery,
          returned,
          createdAt: reservation.createdAt,
        };
        checkouts.push(assignment);
        ids.push(assignment.id);
        if (delivery) {
          audit.push({
            id: randomId('aud'),
            at: delivery.at,
            actorUserId: 'usr_admin',
            actorRole: 'administrador',
            action: 'equipo.entregado',
            entityType: 'equipment_assignment',
            entityId: assignment.id,
            after: { reservationId: reservation.id, assetTag: item.assetTag, checklist: delivery.checklist },
          });
        }
        if (returned) {
          audit.push({
            id: randomId('aud'),
            at: returned.at,
            actorUserId: 'usr_admin',
            actorRole: 'administrador',
            action: 'equipo.devuelto',
            entityType: 'equipment_assignment',
            entityId: assignment.id,
            after: { reservationId: reservation.id, assetTag: item.assetTag, checklist: returned.checklist },
          });
        }
      }
    }
    reservation.equipmentAssignmentIds = ids;
  }

  function createReservation(input: {
    date: string;
    slotId: string;
    spaceCode: string;
    partySize: number;
    peopleIds: string[];
    holderPersonId?: string;
    notes?: string;
    status?: ReservationStatus;
    equipment?: Array<{ type: EquipmentType; count: number }>;
    createdAt?: string;
  }): ReservationRecord | null {
    const space = FLOORPLAN.spaces.find((s) => s.code === input.spaceCode);
    if (!space || !space.bookable) return null;
    if (input.partySize > (space.capacity ?? 0)) return null;
    const seatIds = allocateSeatIds(
      input.spaceCode,
      input.date,
      input.slotId,
      input.partySize,
      usedSeats,
    );
    if (!seatIds) return null;
    const slot = slotById(input.slotId);
    const prefix = input.spaceCode === 'coworking' ? 'CW' : input.spaceCode === 'salon' ? 'SA' : 'SR';
    seq[prefix] += 1;
    const code = `${prefix}-${input.date.slice(0, 4)}-${String(seq[prefix]).padStart(5, '0')}`;
    const id = `res_seed_${input.date.replace(/-/g, '')}_${input.slotId}_${prefix}_${seq[prefix]}`;
    const status = input.status ?? statusFor(input.date, input.slotId);
    const startsAt = isoFor(input.date, slot.start);
    const endsAt = isoFor(input.date, slot.end);
    const createdAt = input.createdAt ?? new Date(Date.parse(startsAt) - 2 * 86_400_000).toISOString();
    const holderId = input.holderPersonId ?? input.peopleIds[0];
    const holder = personById.get(holderId);
    if (!holder) return null;
    const people: ReservationPerson[] = input.peopleIds.slice(0, input.partySize).map((pid, index) => {
      const person = personById.get(pid) ?? holder;
      const p = personFor(person);
      p.role = index === 0 ? 'titular' : 'acompanante';
      if (status === 'en_curso' || status === 'finalizada') {
        p.checkedInAt = new Date(Date.parse(startsAt) + 5 * 60_000).toISOString();
      }
      if (status === 'finalizada') {
        p.checkedOutAt = new Date(Date.parse(endsAt) - 5 * 60_000).toISOString();
      }
      return p;
    });
    if (people.length < input.partySize) return null;
    for (const seatId of seatIds) usedSeats.add(`${input.date}|${input.slotId}|${seatId}`);

    const holderUser =
      holderId === 'per_juan'
        ? 'usr_socio'
        : holderId === 'per_carolina'
          ? 'usr_admin'
          : holderId === 'per_martin'
            ? 'usr_director'
            : undefined;

    const reservation: ReservationRecord = {
      id,
      code,
      spaceCode: input.spaceCode,
      date: input.date,
      slotId: input.slotId,
      startsAt,
      endsAt,
      status,
      partySize: input.partySize,
      holderPersonId: holderId,
      holderUserId: holderUser,
      people,
      seatHolds: seatIds.map((seatId) => ({
        seatId,
        active: status === 'confirmada' || status === 'en_curso' || status === 'finalizada',
      })),
      equipmentAssignmentIds: [],
      notes: input.notes,
      version: 1,
      createdByUserId: holderUser ?? 'usr_admin',
      createdAt,
      updatedAt: createdAt,
      checkedInAt:
        status === 'en_curso' || status === 'finalizada'
          ? new Date(Date.parse(startsAt) + 5 * 60_000).toISOString()
          : undefined,
      checkedOutAt:
        status === 'finalizada'
          ? new Date(Date.parse(endsAt) - 5 * 60_000).toISOString()
          : undefined,
      cancelledAt: status === 'cancelada' ? createdAt : undefined,
      cancellationReason: status === 'cancelada' ? 'Cancelada por el socio' : undefined,
    };

    audit.push({
      id: randomId('aud'),
      at: createdAt,
      actorUserId: reservation.createdByUserId,
      actorRole: holderUser === 'usr_socio' ? 'socio' : 'administrador',
      action: 'reserva.creada',
      entityType: 'reservation',
      entityId: reservation.id,
      after: {
        code: reservation.code,
        spaceCode: reservation.spaceCode,
        date: reservation.date,
        slotId: reservation.slotId,
        partySize: reservation.partySize,
        seats: seatIds,
      },
    });
    if (reservation.checkedInAt) {
      audit.push({
        id: randomId('aud'),
        at: reservation.checkedInAt,
        actorUserId: 'usr_admin',
        actorRole: 'administrador',
        action: 'reserva.check_in',
        entityType: 'reservation',
        entityId: reservation.id,
        after: { code: reservation.code },
      });
    }
    if (reservation.checkedOutAt) {
      audit.push({
        id: randomId('aud'),
        at: reservation.checkedOutAt,
        actorUserId: 'usr_admin',
        actorRole: 'administrador',
        action: 'reserva.finalizada',
        entityType: 'reservation',
        entityId: reservation.id,
        after: { code: reservation.code },
      });
    }
    if (status === 'cancelada') {
      audit.push({
        id: randomId('aud'),
        at: createdAt,
        actorUserId: reservation.createdByUserId,
        actorRole: 'socio',
        action: 'reserva.cancelada',
        entityType: 'reservation',
        entityId: reservation.id,
        after: { code: reservation.code, reason: reservation.cancellationReason },
      });
    }

    reservation.equipmentAssignmentIds = [];
    if (input.equipment?.length) equipmentAssignments(reservation, input.equipment);
    reservations.push(reservation);
    return reservation;
  }

  // Reservas pasadas para analytics (35 días)
  for (let offset = -35; offset <= -1; offset += 1) {
    const date = addDays(today, offset);
    const count = 2 + (Math.abs(offset) % 3 === 0 ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const slot = SETTINGS.slots[(Math.abs(offset) + i) % SETTINGS.slots.length];
      const spaceCodes = ['coworking', 'salon', 'sala-reuniones'];
      const spaceCode = spaceCodes[(Math.abs(offset) + i * 2) % spaceCodes.length];
      const partySize =
        spaceCode === 'sala-reuniones'
          ? 4 + ((Math.abs(offset) + i) % 4)
          : 1 + ((Math.abs(offset) + i) % 4);
      const base = (Math.abs(offset) * 3 + i * 5) % PERSON_SEED.length;
      const peopleIds = Array.from({ length: partySize }, (_, k) => PERSON_SEED[(base + k) % PERSON_SEED.length].id);
      const cancelled = (Math.abs(offset) + i) % 9 === 0;
      const noShow = (Math.abs(offset) + i) % 13 === 0;
      const status: ReservationStatus = cancelled ? 'cancelada' : noShow ? 'no_show' : 'finalizada';
      const equipment =
        (Math.abs(offset) + i) % 3 === 0
          ? [{ type: 'computadora' as const, count: 1 }]
          : (Math.abs(offset) + i) % 5 === 0
            ? [{ type: 'proyector' as const, count: 1 }]
            : [];
      createReservation({ date, slotId: slot.id, spaceCode, partySize, peopleIds, status, equipment });
    }
  }

  // Hoy: escenas clave para el mapa en vivo
  const todayPlan: Array<{
    slotId: string;
    spaceCode: string;
    partySize: number;
    people: string[];
    equipment?: Array<{ type: EquipmentType; count: number }>;
    notes?: string;
  }> = [
    {
      slotId: 'manana',
      spaceCode: 'salon',
      partySize: 2,
      people: ['per_maria', 'per_ana'],
      notes: 'Capacitación de introducción al coworking.',
    },
    {
      slotId: 'manana',
      spaceCode: 'coworking',
      partySize: 3,
      people: ['per_pablo', 'per_diego', 'per_lucia'],
      equipment: [{ type: 'computadora', count: 1 }],
    },
    {
      slotId: 'tarde',
      spaceCode: 'sala-reuniones',
      partySize: 6,
      people: ['per_lucas', 'per_carla', 'per_sofia', 'per_diego', 'per_lucia', 'per_ana'],
      equipment: [{ type: 'proyector', count: 1 }],
      notes: 'Presentación de proyecto para una cooperativa local.',
    },
    {
      slotId: 'tarde',
      spaceCode: 'coworking',
      partySize: 4,
      people: ['per_juan', 'per_maria', 'per_lucas', 'per_ana'],
      equipment: [
        { type: 'computadora', count: 2 },
        { type: 'proyector', count: 0 },
      ],
      notes: 'Equipo de desarrollo. Reserva de referencia con 3 acompañantes.',
    },
  ];
  for (const plan of todayPlan) {
    createReservation({
      date: today,
      slotId: plan.slotId,
      spaceCode: plan.spaceCode,
      partySize: plan.partySize,
      peopleIds: plan.people,
      holderPersonId: plan.people[0],
      equipment: plan.equipment,
      notes: plan.notes,
      createdAt: new Date(Date.parse(`${today}T08:00:00-03:00`) - 86_400_000).toISOString(),
    });
  }

  // Mañana y pasado: disponibilidad futura
  const futurePlan: Array<{ offset: number; slotId: string; spaceCode: string; partySize: number; base: number }> = [
    { offset: 1, slotId: 'manana', spaceCode: 'coworking', partySize: 2, base: 2 },
    { offset: 1, slotId: 'tarde', spaceCode: 'sala-reuniones', partySize: 8, base: 3 },
    { offset: 2, slotId: 'tarde', spaceCode: 'salon', partySize: 4, base: 5 },
    { offset: 3, slotId: 'noche', spaceCode: 'coworking', partySize: 3, base: 7 },
  ];
  for (const plan of futurePlan) {
    const peopleIds = Array.from(
      { length: plan.partySize },
      (_, k) => PERSON_SEED[(plan.base + k) % PERSON_SEED.length].id,
    );
    createReservation({
      date: addDays(today, plan.offset),
      slotId: plan.slotId,
      spaceCode: plan.spaceCode,
      partySize: plan.partySize,
      peopleIds,
      holderPersonId: peopleIds[0],
    });
  }

  // Estado actual del inventario
  for (const item of gear) {
    if (item.status === 'mantenimiento') continue;
    const active = checkouts.some((a) => a.itemId === item.id && a.status === 'entregada');
    item.status = active ? 'en_uso' : 'disponible';
  }

  audit.sort((a, b) => a.at.localeCompare(b.at));

  return {
    meta: { revision: 1, updatedAt: now },
    users,
    persons,
    reservations,
    gear,
    checkouts,
    sessions: [],
    settings: SETTINGS,
    audit,
    idempotency: [],
  };
}
