import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { appConfig } from '../config';
import FLOORPLAN_JSON from '../floorplan/floorplan.generated.json';
import type { FloorplanManifest } from '../floorplan/types';
import { randomId } from '../common/crypto';
import { buildSeedState } from './seed';
import { EventsService } from './events.service';
import type { AuditEventRecord, DbState, ReservationRecord, Role } from './types';

const FLOORPLAN = FLOORPLAN_JSON as unknown as FloorplanManifest;

interface CollectionFile<T> {
  revision: number;
  updatedAt: string;
  data: T;
}

export interface TransactionEvent {
  type: string;
  spaceCode?: string;
  reservationId?: string;
}

@Injectable()
export class JsonDbService implements OnModuleInit {
  private readonly logger = new Logger(JsonDbService.name);
  private state!: DbState;
  private mutex: Promise<void> = Promise.resolve();
  private dataDir = appConfig.dataDir;
  private journalPath = path.join(appConfig.dataDir, 'journal.ndjson');

  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  async onModuleInit(): Promise<void> {
    await fsp.mkdir(this.dataDir, { recursive: true });
    await this.load();
  }

  get floorplan(): FloorplanManifest {
    return FLOORPLAN;
  }

  get snapshot(): Readonly<DbState> {
    return this.state;
  }

  private file(name: string): string {
    return path.join(this.dataDir, name);
  }

  private async readJson<T>(name: string): Promise<T | null> {
    const target = this.file(name);
    try {
      return JSON.parse(await fsp.readFile(target, 'utf8')) as T;
    } catch (error) {
      const backup = `${target}.bak`;
      if (fs.existsSync(backup)) {
        this.logger.warn(`Archivo ${name} ilegible; se restaura la copia de seguridad.`);
        return JSON.parse(await fsp.readFile(backup, 'utf8')) as T;
      }
      if (fs.existsSync(target)) {
        this.logger.error(`Archivo ${name} corrupto y sin backup: ${(error as Error).message}`);
      }
      return null;
    }
  }

  private async load(): Promise<void> {
    const meta = await this.readJson<{ revision: number; updatedAt: string }>('meta.json');
    const users = await this.readJson<CollectionFile<DbState['users']>>('users.json');

    if (!meta || !users) {
      if (appConfig.seedOnStart) {
        this.logger.log('No hay datos locales: generando semilla inicial.');
        this.state = buildSeedState();
        validateState(this.state, FLOORPLAN);
        await this.persist(this.state);
        return;
      }
      throw new Error('No hay datos y SEED_ON_START está deshabilitado.');
    }

    const [
      persons,
      reservations,
      gear,
      checkouts,
      sessions,
      settings,
      audit,
      idempotency,
    ] = await Promise.all([
      this.readJson<CollectionFile<DbState['persons']>>('persons.json'),
      this.readJson<CollectionFile<DbState['reservations']>>('reservations.json'),
      this.readJson<CollectionFile<DbState['gear']>>('gear.json'),
      this.readJson<CollectionFile<DbState['checkouts']>>('checkouts.json'),
      this.readJson<CollectionFile<DbState['sessions']>>('sessions.json'),
      this.readJson<CollectionFile<DbState['settings']>>('settings.json'),
      this.readJson<CollectionFile<DbState['audit']>>('audit.json'),
      this.readJson<CollectionFile<DbState['idempotency']>>('idempotency.json'),
    ]);

    if (!persons || !reservations || !gear || !checkouts || !settings || !audit) {
      throw new Error('Faltan archivos de datos obligatorios en ' + this.dataDir);
    }

    this.state = {
      meta,
      users: users.data,
      persons: persons.data,
      reservations: reservations.data,
      gear: gear.data,
      checkouts: checkouts.data,
      sessions: sessions?.data ?? [],
      settings: settings.data,
      audit: audit.data,
      idempotency: idempotency?.data ?? [],
    };

    // Recuperación desde el write-ahead log: si la última transacción completa
    // tiene una revisión mayor que la de los snapshots, se restaura ese estado.
    try {
      if (fs.existsSync(this.journalPath)) {
        const raw = await fsp.readFile(this.journalPath, 'utf8');
        const lines = raw.split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          try {
            const entry = JSON.parse(lines[i]) as { revision: number; state: DbState };
            if (entry.revision > this.state.meta.revision && entry.state?.meta) {
              this.logger.warn(
                `Recuperando estado desde journal (revisión ${entry.revision} > ${this.state.meta.revision}).`,
              );
              this.state = entry.state;
              await this.persist(this.state);
              break;
            }
          } catch {
            // línea parcial al final del archivo: se ignora
          }
        }
      }
    } catch (error) {
      this.logger.warn(`No se pudo leer el journal: ${(error as Error).message}`);
    }

    validateState(this.state, FLOORPLAN);
    this.logger.log(
      `Datos cargados: ${this.state.users.length} usuarios, ` +
        `${this.state.reservations.length} reservas, ${this.state.gear.length} equipos.`,
    );
  }

  async transaction<T>(fn: (draft: DbState) => T | Promise<T>, event?: TransactionEvent): Promise<T> {
    const run = async (): Promise<T> => {
      const draft = structuredClone(this.state);
      const result = await fn(draft);
      draft.meta.revision = this.state.meta.revision + 1;
      draft.meta.updatedAt = new Date().toISOString();
      validateState(draft, FLOORPLAN);
      await this.persist(draft);
      this.state = draft;
      if (event) {
        this.events.emit({
          type: event.type,
          revision: draft.meta.revision,
          spaceCode: event.spaceCode,
          reservationId: event.reservationId,
        });
      }
      return result;
    };

    const next = this.mutex.then(run, run);
    this.mutex = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async persist(state: DbState): Promise<void> {
    const now = new Date().toISOString();
    const journalEntry = JSON.stringify({ revision: state.meta.revision, at: now, state });
    await fsp.appendFile(this.journalPath, `${journalEntry}\n`, 'utf8');

    await Promise.all([
      this.atomicWrite('users.json', { revision: state.meta.revision, updatedAt: now, data: state.users }),
      this.atomicWrite('persons.json', { revision: state.meta.revision, updatedAt: now, data: state.persons }),
      this.atomicWrite('reservations.json', {
        revision: state.meta.revision,
        updatedAt: now,
        data: state.reservations,
      }),
      this.atomicWrite('gear.json', { revision: state.meta.revision, updatedAt: now, data: state.gear }),
      this.atomicWrite('checkouts.json', {
        revision: state.meta.revision,
        updatedAt: now,
        data: state.checkouts,
      }),
      this.atomicWrite('sessions.json', {
        revision: state.meta.revision,
        updatedAt: now,
        data: state.sessions,
      }),
      this.atomicWrite('settings.json', {
        revision: state.meta.revision,
        updatedAt: now,
        data: state.settings,
      }),
      this.atomicWrite('audit.json', { revision: state.meta.revision, updatedAt: now, data: state.audit }),
      this.atomicWrite('idempotency.json', {
        revision: state.meta.revision,
        updatedAt: now,
        data: state.idempotency,
      }),
      this.atomicWrite('meta.json', { revision: state.meta.revision, updatedAt: state.meta.updatedAt }),
    ]);

    await this.compactJournal(state);
  }

  private async atomicWrite(name: string, payload: unknown): Promise<void> {
    const target = this.file(name);
    const tmp = `${target}.${process.pid}.tmp`;
    const body = `${JSON.stringify(payload, null, 2)}\n`;
    if (fs.existsSync(target)) {
      await fsp.copyFile(target, `${target}.bak`);
    }
    const handle = await fsp.open(tmp, 'w');
    try {
      await handle.writeFile(body, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fsp.rename(tmp, target);
    } catch {
      await fsp.copyFile(tmp, target);
      await fsp.unlink(tmp).catch(() => undefined);
    }
  }

  private async compactJournal(state: DbState): Promise<void> {
    try {
      const stats = await fsp.stat(this.journalPath);
      if (stats.size < 4 * 1024 * 1024) return;
      const tmp = `${this.journalPath}.tmp`;
      const entry = JSON.stringify({
        revision: state.meta.revision,
        at: new Date().toISOString(),
        state,
      });
      await fsp.writeFile(tmp, `${entry}\n`, 'utf8');
      await fsp.rename(tmp, this.journalPath);
      this.logger.log('Journal compactado.');
    } catch {
      // La compactación no debe bloquear la transacción.
    }
  }

  pushAudit(
    draft: DbState,
    input: {
      actorUserId?: string;
      actorRole?: Role | 'sistema';
      action: string;
      entityType: string;
      entityId: string;
      before?: unknown;
      after?: unknown;
      ip?: string;
      requestId?: string;
    },
  ): AuditEventRecord {
    const event: AuditEventRecord = {
      id: randomId('aud'),
      at: new Date().toISOString(),
      ...input,
    };
    draft.audit.push(event);
    return event;
  }

  nextReservationCode(draft: DbState, spaceCode: string, year: string): string {
    const prefix = spaceCode === 'coworking' ? 'CW' : spaceCode === 'salon' ? 'SA' : 'SR';
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    let max = 0;
    for (const reservation of draft.reservations) {
      const match = pattern.exec(reservation.code);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `${prefix}-${year}-${String(max + 1).padStart(5, '0')}`;
  }

  findReservation(draft: DbState, id: string): ReservationRecord | undefined {
    return draft.reservations.find((r) => r.id === id);
  }
}

export function validateState(state: DbState, floorplan: FloorplanManifest): void {
  const fail = (message: string): never => {
    throw new Error(`Estado JSON inválido: ${message}`);
  };
  const unique = <T>(items: T[], key: (item: T) => string, label: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      const value = key(item);
      if (seen.has(value)) fail(`${label} duplicado: ${value}`);
      seen.add(value);
    }
  };

  unique(state.users, (u) => u.id, 'usuario id');
  unique(state.users, (u) => u.email.toLowerCase(), 'usuario email');
  unique(state.persons, (p) => p.id, 'persona id');
  unique(state.persons, (p) => p.docHash, 'persona documento');
  unique(state.reservations, (r) => r.id, 'reserva id');
  unique(state.reservations, (r) => r.code, 'reserva código');
  unique(state.gear, (g) => g.id, 'equipo id');
  unique(state.gear, (g) => g.assetTag, 'equipo activo');
  unique(state.checkouts, (c) => c.id, 'asignación id');

  const personIds = new Set(state.persons.map((p) => p.id));
  const itemIds = new Set(state.gear.map((g) => g.id));
  const reservationIds = new Set(state.reservations.map((r) => r.id));
  const seatIds = new Set(floorplan.furniture.flatMap((f) => f.seats.map((s) => s.id)));
  const spaceCodes = new Set(floorplan.spaces.filter((s) => s.bookable).map((s) => s.code));

  for (const user of state.users) {
    if (!personIds.has(user.personId)) fail(`usuario ${user.id} sin persona`);
  }
  for (const reservation of state.reservations) {
    if (!spaceCodes.has(reservation.spaceCode)) fail(`reserva ${reservation.id} con espacio inválido`);
    if (!personIds.has(reservation.holderPersonId)) fail(`reserva ${reservation.id} sin titular`);
    if (reservation.people.length !== reservation.partySize) {
      fail(`reserva ${reservation.id} con partySize inconsistente`);
    }
    for (const person of reservation.people) {
      if (!personIds.has(person.personId)) fail(`reserva ${reservation.id} con persona inexistente`);
    }
    for (const hold of reservation.seatHolds) {
      if (!seatIds.has(hold.seatId)) fail(`reserva ${reservation.id} con asiento inexistente: ${hold.seatId}`);
    }
    for (const assignmentId of reservation.equipmentAssignmentIds) {
      if (!state.checkouts.some((c) => c.id === assignmentId)) {
        fail(`reserva ${reservation.id} con asignación inexistente`);
      }
    }
  }
  for (const assignment of state.checkouts) {
    if (!reservationIds.has(assignment.reservationId)) fail(`asignación ${assignment.id} sin reserva`);
    if (!itemIds.has(assignment.itemId)) fail(`asignación ${assignment.id} sin equipo`);
  }

  const active = state.reservations.filter(
    (r) => r.status === 'confirmada' || r.status === 'en_curso' || r.status === 'finalizada',
  );
  const seatMap = new Map<string, string>();
  for (const reservation of active) {
    for (const hold of reservation.seatHolds.filter((h) => h.active)) {
      const key = `${reservation.date}|${reservation.slotId}|${hold.seatId}`;
      const previous = seatMap.get(key);
      if (previous && previous !== reservation.id) {
        fail(`solapamiento de asiento ${hold.seatId} (${previous} / ${reservation.id})`);
      }
      seatMap.set(key, reservation.id);
    }
  }
  const equipmentMap = new Map<string, string>();
  for (const assignment of state.checkouts.filter((c) => c.status === 'reservada' || c.status === 'entregada')) {
    const key = `${assignment.date}|${assignment.slotId}|${assignment.itemId}`;
    const previous = equipmentMap.get(key);
    if (previous && previous !== assignment.reservationId) {
      fail(`solapamiento de equipo ${assignment.assetTag}`);
    }
    equipmentMap.set(key, assignment.reservationId);
  }
}
