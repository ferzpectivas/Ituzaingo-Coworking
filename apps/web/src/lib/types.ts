export type Role = 'socio' | 'administrador' | 'director';

export interface Me {
  id: string;
  email: string;
  role: Role;
  permissions: string[];
  person: {
    id: string;
    firstName: string;
    lastName: string;
    docLast4: string;
  };
}

export interface Slot {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface Settings {
  spaceName: string;
  organization: string;
  address: string;
  timezone: string;
  slots: Slot[];
  maxAdvanceDays: number;
  cancellationHours: number;
  checkinGraceMinutes: number;
}

export interface Seat {
  id: string;
  index: number;
  position: { x: number; z: number };
  rotationY: number;
}

export interface Furniture {
  code: string;
  label: string;
  spaceCode: string;
  kind: 'pupitre' | 'mesa' | 'mesa_ejecutiva';
  capacity: number;
  position: { x: number; z: number };
  size: { width: number; depth: number };
  rotation: number;
  longAxis: 'x' | 'z';
  svgRef: string;
  seats: Seat[];
}

export interface Space {
  code: string;
  name: string;
  description: string;
  color: string;
  accent: string;
  bookable: boolean;
  bounds: { x: number; z: number; width: number; depth: number };
  centroid: { x: number; z: number };
  labelPosition: { x: number; z: number };
  number: number;
  furnitureCount?: number;
  capacity?: number;
  seatCount?: number;
}

export interface WallBox {
  x: number;
  z: number;
  width: number;
  depth: number;
  y: number;
  height: number;
  kind: string;
}

export interface Opening {
  type: 'door' | 'window';
  axis: 'h' | 'v';
  line: number;
  from: number;
  to: number;
  y0: number;
  y1: number;
  glass: boolean;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface Floorplan {
  revision: string;
  generatedAt: string;
  source: string;
  scale: number;
  origin: { x: number; y: number };
  bounds: { x: number; z: number; width: number; depth: number };
  wallHeight: number;
  wallThickness: number;
  spaces: Space[];
  furniture: Furniture[];
  walls: Array<{ x1: number; z1: number; x2: number; z2: number }>;
  wallBoxes: WallBox[];
  openings: Opening[];
  decor: Array<{
    type: string;
    position: { x: number; z: number };
    size?: { width: number; depth: number };
    rotation?: number;
  }>;
  labels: Array<{ text: string; x: number; y: number }>;
  totals: { spaces: number; furniture: number; seats: number; desks: number; tables: number };
}

export interface PublicOverview {
  organization: string;
  spaceName: string;
  address: string;
  timezone: string;
  today: string;
  slots: Slot[];
  policies: { maxAdvanceDays: number; cancellationHours: number; checkinGraceMinutes: number };
  spaces: Array<
    Pick<Space, 'code' | 'name' | 'description' | 'color' | 'accent' | 'capacity' | 'furnitureCount' | 'bounds' | 'centroid' | 'number'>
  >;
  totals: Floorplan['totals'];
  equipment: { computers: number; projectors: number; whiteboards: number };
}

export interface ConfigResponse {
  settings: Settings;
  spaces: Space[];
  today: string;
  currentSlotId: string;
  revision: number;
}

export interface OccupancyReservation {
  id: string;
  code: string;
  holder: { displayName: string; firstName: string; lastName: string };
  people?: Array<{ firstName: string; lastName: string; role: string; docLast4: string }>;
  companionsCount: number;
  peopleCount: number;
  seatIds: string[];
  furnitureCodes: string[];
  startsAt: string;
  endsAt: string;
  status: string;
  notes?: string;
  equipment: { computers: number; projectors: number; whiteboards: number };
  isMine: boolean;
}

export interface OccupancyFurniture {
  code: string;
  label: string;
  kind: string;
  capacity: number;
  occupiedSeats: number;
  freeSeats: number;
  status: 'libre' | 'parcial' | 'completo';
  seatStatus: Record<string, 'libre' | 'ocupado' | 'mio'>;
}

export interface OccupancySpace {
  code: string;
  name: string;
  description: string;
  color: string;
  accent: string;
  capacity: number;
  occupiedSeats: number;
  freeSeats: number;
  bounds: Space['bounds'];
  centroid: { x: number; z: number };
  furniture: OccupancyFurniture[];
  reservations: OccupancyReservation[];
}

export interface Occupancy {
  generatedAt: string;
  revision: number;
  date: string;
  slot: Slot;
  timezone: string;
  totals: { capacity: number; occupiedSeats: number; reservations: number; people: number };
  spaces: OccupancySpace[];
}

export interface AvailabilitySeat {
  id: string;
  index: number;
  status: 'libre' | 'ocupado';
}

export interface AvailabilitySpace {
  code: string;
  name: string;
  capacity: number;
  occupiedSeats: number;
  freeSeats: number;
  fitsParty?: boolean;
  furniture: Array<{
    code: string;
    label: string;
    kind: string;
    capacity: number;
    freeSeats: number;
    seats: AvailabilitySeat[];
  }>;
}

export interface EquipmentAvailability {
  type: 'computadora' | 'proyector' | 'pizarra';
  total: number;
  available: number;
  items: Array<{
    id: string;
    assetTag: string;
    model: string;
    accessories: Record<string, boolean>;
  }>;
}

export interface Availability {
  date: string;
  slot: Slot;
  spaces: AvailabilitySpace[];
  equipment: EquipmentAvailability[];
  revision: number;
  generatedAt: string;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  docType: 'DNI' | 'PASAPORTE' | 'CUIL';
  docNumber?: string;
  role?: 'titular' | 'acompanante';
}

export interface CreateReservationInput {
  spaceCode: string;
  date: string;
  slotId: string;
  partySize: number;
  people: PersonInput[];
  equipment?: { computers?: number; projectors?: number; whiteboards?: number };
  notes?: string;
}

export interface ReservationEquipment {
  assignmentId: string;
  itemId: string;
  assetTag: string;
  type: 'computadora' | 'proyector' | 'pizarra';
  model?: string;
  serial?: string;
  status: 'reservada' | 'entregada' | 'devuelta' | 'cancelada';
  requiredAccessories: Array<{ code: string; label: string; present: boolean }>;
  delivery?: ChecklistRecord;
  returned?: ChecklistRecord;
  incident?: IncidentRecord;
}

export interface ChecklistRecord {
  at: string;
  byUserId: string;
  checklist: Record<string, boolean>;
  allOk: boolean;
  observations?: string;
}

export interface IncidentRecord {
  at: string;
  byUserId: string;
  kind: 'faltante' | 'daño';
  accessories: string[];
  description: string;
  resolved: boolean;
}

export interface ReservationDetail {
  id: string;
  code: string;
  space: { code: string; name: string; color?: string };
  date: string;
  slot: { id: string; label: string };
  startsAt: string;
  endsAt: string;
  status: 'confirmada' | 'en_curso' | 'finalizada' | 'cancelada' | 'no_show';
  partySize: number;
  companionsCount: number;
  holder: {
    displayName: string;
    firstName: string;
    lastName: string;
    docType: string;
    docLast4: string;
  };
  people: Array<{
    firstName: string;
    lastName: string;
    role: string;
    docType: string;
    docLast4: string;
    checkedInAt?: string;
    checkedOutAt?: string;
  }>;
  seats: Array<{
    id: string;
    active: boolean;
    furnitureCode?: string;
    furnitureLabel?: string;
    spaceCode?: string;
    index?: number;
  }>;
  equipment: ReservationEquipment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  version: number;
  isMine: boolean;
  actions: {
    canEdit: boolean;
    canCancel: boolean;
    canCheckIn: boolean;
    canCheckOut: boolean;
    canNoShow: boolean;
    canDeliver: boolean;
    canReturn: boolean;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  revision: number;
  serverTime?: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  actorRole: string;
  detail?: { before?: unknown; after?: unknown };
}

export interface ReportSummary {
  range: { from: string; to: string; days: number; label: string };
  generatedAt: string;
  timezone: string;
  totals: {
    reservations: number;
    activeReservations: number;
    cancelled: number;
    noShow: number;
    people: number;
    capacity: number;
    availableSeatSlots: number;
    occupiedSeatSlots: number;
    occupancyRate: number;
    cancellationRate: number;
    noShowRate: number;
    averagePartySize: number;
  };
  bySpace: Array<{
    code: string;
    name: string;
    color: string;
    capacity: number;
    reservations: number;
    people: number;
    cancelled: number;
    noShow: number;
    occupancyRate: number;
    availableSeatSlots: number;
    occupiedSeatSlots: number;
  }>;
  bySlot: Array<{
    id: string;
    label: string;
    reservations: number;
    people: number;
    occupancyRate: number;
  }>;
  byWeekday: Array<{ weekday: number; name: string; reservations: number; people: number }>;
  byDay: Array<{
    date: string;
    reservations: number;
    people: number;
    cancelled: number;
    noShow: number;
    occupancyRate: number;
  }>;
  equipment: {
    computers: number;
    projectors: number;
    whiteboards: number;
    reservations: number;
    deliveries: number;
    returns: number;
    incidents: number;
    incidentsOpen: number;
    utilizationRate: number;
  };
  peak: {
    day: { date: string; reservations: number; people: number; occupancyRate: number } | null;
    slot: { id: string; label: string; reservations: number; people: number } | null;
  };
}

export interface AuditItem {
  id: string;
  at: string;
  action: string;
  entityType: string;
  entityId: string;
  actorRole: string;
  actor: string;
  actorEmail?: string;
  ip?: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditResponse {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
  actions: string[];
  revision: number;
}

export interface EquipmentItem {
  id: string;
  assetTag: string;
  type: 'computadora' | 'proyector' | 'pizarra';
  model: string;
  serial: string;
  status: 'disponible' | 'en_uso' | 'mantenimiento';
  notes?: string;
  accessories: Array<{ code: string; label: string; present: boolean }>;
  updatedAt: string;
}

export interface EquipmentInventory {
  items: EquipmentItem[];
  totals: {
    total: number;
    computadoras: number;
    proyectores: number;
    pizarras: number;
    disponibles: number;
    enUso: number;
    mantenimiento: number;
  };
  revision: number;
}

export interface EquipmentAssignment {
  id: string;
  reservationId: string;
  reservationCode?: string;
  itemId: string;
  assetTag: string;
  type: 'computadora' | 'proyector' | 'pizarra';
  model?: string;
  status: 'reservada' | 'entregada' | 'devuelta' | 'cancelada';
  date: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  requiredAccessories: Array<{ code: string; label: string }>;
  delivery?: ChecklistRecord;
  returned?: ChecklistRecord;
  incident?: IncidentRecord;
}
