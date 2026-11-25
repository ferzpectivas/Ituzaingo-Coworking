import type { SealedValue } from '../common/crypto';

export type Role = 'socio' | 'administrador' | 'director';
export type DocType = 'DNI' | 'PASAPORTE' | 'CUIL';
export type ReservationStatus = 'confirmada' | 'en_curso' | 'finalizada' | 'cancelada' | 'no_show';
export type PersonRole = 'titular' | 'acompanante';
export type EquipmentType = 'computadora' | 'proyector' | 'pizarra';
export type EquipmentStatus = 'disponible' | 'en_uso' | 'mantenimiento';
export type AssignmentStatus = 'reservada' | 'entregada' | 'devuelta' | 'cancelada';
export type AccessoryCode = 'funda' | 'cargador' | 'caja' | 'hdmi' | 'vga' | 'cable_energia';

export interface PersonRecord {
  id: string;
  firstName: string;
  lastName: string;
  docType: DocType;
  docHash: string;
  docLast4: string;
  docSealed: SealedValue;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  personId: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
  ip?: string;
  userAgent?: string;
}

export interface ReservationPerson {
  personId: string;
  firstName: string;
  lastName: string;
  docType: DocType;
  docHash: string;
  docLast4: string;
  role: PersonRole;
  checkedInAt?: string;
  checkedOutAt?: string;
}

export interface SeatHold {
  seatId: string;
  active: boolean;
}

export interface ReservationRecord {
  id: string;
  code: string;
  spaceCode: string;
  date: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  partySize: number;
  holderPersonId: string;
  holderUserId?: string;
  people: ReservationPerson[];
  seatHolds: SeatHold[];
  equipmentAssignmentIds: string[];
  notes?: string;
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export type AccessoryChecklist = Partial<Record<AccessoryCode, boolean>>;
export type EquipmentAccessories = Record<AccessoryCode, boolean>;

export interface EquipmentItemRecord {
  id: string;
  assetTag: string;
  type: EquipmentType;
  model: string;
  serial: string;
  status: EquipmentStatus;
  accessories: EquipmentAccessories;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistRecord {
  at: string;
  byUserId: string;
  checklist: AccessoryChecklist;
  allOk: boolean;
  observations?: string;
}

export interface IncidentRecord {
  at: string;
  byUserId: string;
  kind: 'faltante' | 'daño';
  accessories: AccessoryCode[];
  description: string;
  resolved: boolean;
}

export interface EquipmentAssignmentRecord {
  id: string;
  reservationId: string;
  itemId: string;
  type: EquipmentType;
  assetTag: string;
  status: AssignmentStatus;
  date: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  delivery?: ChecklistRecord;
  returned?: ChecklistRecord;
  incident?: IncidentRecord;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  at: string;
  actorUserId?: string;
  actorRole?: Role | 'sistema';
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  requestId?: string;
}

export interface SlotConfig {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface SettingsRecord {
  spaceName: string;
  organization: string;
  address: string;
  timezone: string;
  openingDays: number[];
  slots: SlotConfig[];
  maxAdvanceDays: number;
  cancellationHours: number;
  checkinGraceMinutes: number;
}

export interface IdempotencyRecord {
  key: string;
  reservationId: string;
  createdAt: string;
}

export interface DbState {
  meta: { revision: number; updatedAt: string };
  users: UserRecord[];
  persons: PersonRecord[];
  reservations: ReservationRecord[];
  gear: EquipmentItemRecord[];
  checkouts: EquipmentAssignmentRecord[];
  sessions: SessionRecord[];
  settings: SettingsRecord;
  audit: AuditEventRecord[];
  idempotency: IdempotencyRecord[];
}

export const REQUIRED_ACCESSORIES: Record<EquipmentType, AccessoryCode[]> = {
  computadora: ['funda', 'cargador'],
  proyector: ['caja', 'hdmi', 'vga', 'cable_energia'],
  pizarra: [],
};

export const ACCESSORY_LABELS: Record<AccessoryCode, string> = {
  funda: 'Funda',
  cargador: 'Cargador',
  caja: 'Caja',
  hdmi: 'Cable HDMI',
  vga: 'Cable VGA',
  cable_energia: 'Cable de energía',
};
