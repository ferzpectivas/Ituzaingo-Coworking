import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JsonDbService } from '../storage/json-db.service';
import type { AuthUser } from '../common/auth-user';
import {
  hashDocument,
  lastFour,
  normalizeDocument,
  randomId,
  seal,
} from '../common/crypto';
import { addDays, isoFor, todayISO } from '../common/time';
import { assertBookableDate, isOpenDate, resolveDate, slotLabel, slotOf } from '../common/slots';
import { displayName, holderOf } from '../common/serializers';
import type {
  AccessoryCode,
  DbState,
  DocType,
  EquipmentAssignmentRecord,
  EquipmentItemRecord,
  EquipmentType,
  PersonRecord,
  ReservationPerson,
  ReservationRecord,
  ReservationStatus,
  SlotConfig,
} from '../storage/types';
import { ACCESSORY_LABELS, REQUIRED_ACCESSORIES } from '../storage/types';
import type {
  CreateReservationDto,
  PersonInputDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import { PersonRoleDto } from './dto/reservation.dto';

export interface ListReservationsQuery {
  from?: string;
  to?: string;
  space?: string;
  status?: string;
  q?: string;
  equipment?: string;
  limit?: number;
  offset?: number;
}

interface PeopleBuildResult {
  people: ReservationPerson[];
  holderPersonId: string;
  holderUserId?: string;
}

@Injectable()
export class ReservationsService {
  constructor(private readonly db: JsonDbService) {}

  private spaceByCode(code: string) {
    const space = this.db.floorplan.spaces.find((s) => s.code === code);
    if (!space || !space.bookable) {
      throw new BadRequestException({
        code: 'SPACE_INVALID',
        message: 'El espacio seleccionado no se puede reservar.',
      });
    }
    return space;
  }

  private seatBusy(
    state: DbState,
    date: string,
    slotId: string,
    seatId: string,
    excludeReservationId?: string,
  ): boolean {
    return state.reservations.some(
      (r) =>
        r.id !== excludeReservationId &&
        r.date === date &&
        r.slotId === slotId &&
        r.status !== 'cancelada' &&
        r.status !== 'no_show' &&
        r.seatHolds.some((h) => h.seatId === seatId && h.active),
    );
  }

  private freeSeats(
    state: DbState,
    spaceCode: string,
    date: string,
    slotId: string,
    excludeReservationId?: string,
  ): string[] {
    const seats = this.db.floorplan.furniture
      .filter((f) => f.spaceCode === spaceCode)
      .flatMap((f) => f.seats.map((s) => s.id));
    return seats.filter((id) => !this.seatBusy(state, date, slotId, id, excludeReservationId));
  }

  private allocateSeats(
    state: DbState,
    spaceCode: string,
    date: string,
    slotId: string,
    partySize: number,
    preferred: string[] | undefined,
    excludeReservationId?: string,
  ): string[] {
    const space = this.spaceByCode(spaceCode);
    if (partySize > (space.capacity ?? 0)) {
      throw new UnprocessableEntityException({
        code: 'CAPACITY_EXCEEDED',
        message: `El espacio admite hasta ${space.capacity} personas.`,
      });
    }
    const units = this.db.floorplan.furniture.filter((f) => f.spaceCode === spaceCode);
    const validSeatIds = new Set(units.flatMap((u) => u.seats.map((s) => s.id)));
    const free = new Set(this.freeSeats(state, spaceCode, date, slotId, excludeReservationId));

    if (spaceCode === 'sala-reuniones') {
      const all = units.flatMap((u) => u.seats.map((s) => s.id));
      if (all.some((id) => !free.has(id))) {
        throw this.seatConflict(state, spaceCode, date, slotId, partySize, free.size);
      }
      return all;
    }

    if (preferred?.length) {
      const unique = [...new Set(preferred)];
      if (unique.length !== partySize) {
        throw new BadRequestException({
          code: 'SEAT_SELECTION_MISMATCH',
          message: `Seleccioná exactamente ${partySize} asientos.`,
        });
      }
      if (unique.some((id) => !validSeatIds.has(id))) {
        throw new BadRequestException({
          code: 'SEAT_INVALID',
          message: 'Alguno de los asientos no pertenece al espacio.',
        });
      }
      if (unique.some((id) => !free.has(id))) {
        throw this.seatConflict(state, spaceCode, date, slotId, partySize, free.size);
      }
      return unique;
    }

    const candidates = units
      .map((unit) => ({
        unit,
        free: unit.seats.map((s) => s.id).filter((id) => free.has(id)),
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
    if (chosen.length < partySize) {
      throw this.seatConflict(state, spaceCode, date, slotId, partySize, free.size);
    }
    return chosen;
  }

  private seatConflict(
    state: DbState,
    spaceCode: string,
    date: string,
    slotId: string,
    partySize: number,
    freeSeats: number,
  ): ConflictException {
    return new ConflictException({
      code: 'SEAT_UNAVAILABLE',
      message: 'No hay suficientes asientos libres en esa franja.',
      meta: {
        freeSeats,
        partySize,
        alternatives: this.suggestAlternatives(state, spaceCode, date, slotId, partySize),
      },
    });
  }

  private suggestAlternatives(
    state: DbState,
    spaceCode: string,
    date: string,
    slotId: string,
    partySize: number,
  ): Array<{ date: string; slotId: string; label: string; freeSeats: number }> {
    const out: Array<{ date: string; slotId: string; label: string; freeSeats: number }> = [];
    for (let dayOffset = 0; dayOffset <= 7 && out.length < 4; dayOffset += 1) {
      const currentDate = addDays(date, dayOffset);
      if (!isOpenDate(currentDate, state.settings)) continue;
      for (const slot of state.settings.slots) {
        if (dayOffset === 0 && slot.id === slotId) continue;
        const free = this.freeSeats(state, spaceCode, currentDate, slot.id).length;
        if (free >= partySize) {
          out.push({ date: currentDate, slotId: slot.id, label: slot.label, freeSeats: free });
        }
        if (out.length >= 4) break;
      }
    }
    return out;
  }

  private equipmentBusyIds(
    state: DbState,
    date: string,
    slotId: string,
    excludeReservationId?: string,
  ): Set<string> {
    return new Set(
      state.checkouts
        .filter(
          (c) =>
            c.date === date &&
            c.slotId === slotId &&
            (c.status === 'reservada' || c.status === 'entregada') &&
            c.reservationId !== excludeReservationId,
        )
        .map((c) => c.itemId),
    );
  }

  private allocateEquipment(
    state: DbState,
    date: string,
    slotId: string,
    counts: { computers: number; projectors: number; whiteboards: number },
    excludeReservationId?: string,
  ): EquipmentItemRecord[] {
    const used = this.equipmentBusyIds(state, date, slotId, excludeReservationId);
    const selected: EquipmentItemRecord[] = [];
    const wants: Array<{ type: EquipmentType; count: number }> = [
      { type: 'computadora', count: counts.computers },
      { type: 'proyector', count: counts.projectors },
      { type: 'pizarra', count: counts.whiteboards },
    ];
    for (const want of wants) {
      if (want.count <= 0) continue;
      const available = state.gear
        .filter(
          (item) =>
            item.type === want.type &&
            item.status !== 'mantenimiento' &&
            !used.has(item.id) &&
            REQUIRED_ACCESSORIES[item.type].every((code) => item.accessories[code]),
        )
        .sort((a, b) => a.assetTag.localeCompare(b.assetTag));
      if (available.length < want.count) {
        throw new ConflictException({
          code: 'EQUIPMENT_UNAVAILABLE',
          message:
            want.type === 'computadora'
              ? 'No hay notebooks disponibles en esa franja.'
              : want.type === 'proyector'
                ? 'No hay proyectores disponibles en esa franja.'
                : 'No hay pizarras desplazables disponibles en esa franja.',
          meta: {
            type: want.type,
            requested: want.count,
            available: available.length,
          },
        });
      }
      selected.push(...available.slice(0, want.count));
    }
    return selected;
  }

  private createAssignments(
    state: DbState,
    reservation: ReservationRecord,
    items: EquipmentItemRecord[],
  ): void {
    reservation.equipmentAssignmentIds = [];
    for (const item of items) {
      const assignment: EquipmentAssignmentRecord = {
        id: randomId('asg'),
        reservationId: reservation.id,
        itemId: item.id,
        type: item.type,
        assetTag: item.assetTag,
        status: 'reservada',
        date: reservation.date,
        slotId: reservation.slotId,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        createdAt: new Date().toISOString(),
      };
      state.checkouts.push(assignment);
      reservation.equipmentAssignmentIds.push(assignment.id);
    }
  }

  private releaseAssignments(state: DbState, reservation: ReservationRecord): void {
    for (const id of reservation.equipmentAssignmentIds) {
      const assignment = state.checkouts.find((c) => c.id === id);
      if (assignment && assignment.status === 'reservada') {
        assignment.status = 'cancelada';
      }
    }
    reservation.equipmentAssignmentIds = [];
  }

  private buildPeople(
    state: DbState,
    user: AuthUser,
    input: PersonInputDto[],
    partySize: number,
  ): PeopleBuildResult {
    if (input.length !== partySize) {
      throw new BadRequestException({
        code: 'PEOPLE_COUNT_MISMATCH',
        message: `La reserva es para ${partySize} personas y se informaron ${input.length}.`,
      });
    }
    if (input[0]?.role && input[0].role !== PersonRoleDto.titular) {
      throw new BadRequestException({
        code: 'HOLDER_REQUIRED',
        message: 'La primera persona debe ser el titular.',
      });
    }
    if (input.slice(1).some((p) => p.role === PersonRoleDto.titular)) {
      throw new BadRequestException({
        code: 'MULTIPLE_HOLDERS',
        message: 'Solo puede haber un titular por reserva.',
      });
    }

    const people: ReservationPerson[] = [];
    const seenDocs = new Set<string>();
    let holderPersonId = '';

    input.forEach((person, index) => {
      const isHolder = index === 0;

      // Para socios, el titular es siempre la persona autenticada. Su documento
      // ya está registrado en la cuenta y no hace falta volver a tipearlo.
      if (isHolder && user.role === 'socio') {
        const holder = state.persons.find((p) => p.id === user.personId);
        if (!holder) {
          throw new ForbiddenException({
            code: 'HOLDER_MISMATCH',
            message: 'No se encontró la persona asociada a tu cuenta.',
          });
        }
        seenDocs.add(holder.docHash);
        holderPersonId = holder.id;
        people.push({
          personId: holder.id,
          firstName: holder.firstName,
          lastName: holder.lastName,
          docType: holder.docType,
          docHash: holder.docHash,
          docLast4: holder.docLast4,
          role: 'titular',
        });
        return;
      }

      const docType = person.docType as DocType;
      if (!person.docNumber || person.docNumber.trim().length === 0) {
        throw new BadRequestException({
          code: 'DOCUMENT_REQUIRED',
          message: `Falta el documento de ${person.firstName} ${person.lastName}.`,
        });
      }
      const normalized = normalizeDocument(person.docNumber);
      if (docType === 'DNI' && !/^\d{7,9}$/.test(normalized)) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT',
          message: `El DNI de ${person.firstName} debe tener entre 7 y 9 dígitos.`,
        });
      }
      if (docType === 'CUIL' && !/^\d{11}$/.test(normalized)) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT',
          message: `El CUIL de ${person.firstName} debe tener 11 dígitos.`,
        });
      }
      if (docType === 'PASAPORTE' && !/^[A-Z0-9]{5,15}$/.test(normalized)) {
        throw new BadRequestException({
          code: 'INVALID_DOCUMENT',
          message: `El pasaporte de ${person.firstName} no es válido.`,
        });
      }
      const docHash = hashDocument(docType, normalized);
      if (seenDocs.has(docHash)) {
        throw new BadRequestException({
          code: 'DUPLICATE_PERSON',
          message: 'No se puede repetir una misma persona en la reserva.',
        });
      }
      seenDocs.add(docHash);

      let record = state.persons.find((p) => p.docHash === docHash);
      if (!record) {
        const now = new Date().toISOString();
        record = {
          id: randomId('per'),
          firstName: person.firstName.trim(),
          lastName: person.lastName.trim(),
          docType,
          docHash,
          docLast4: lastFour(normalized),
          docSealed: seal(normalized),
          createdAt: now,
          updatedAt: now,
        } satisfies PersonRecord;
        state.persons.push(record);
      }
      const reservationPerson: ReservationPerson = {
        personId: record.id,
        firstName: record.firstName,
        lastName: record.lastName,
        docType: record.docType,
        docHash: record.docHash,
        docLast4: record.docLast4,
        role: isHolder ? 'titular' : 'acompanante',
      };
      if (isHolder) holderPersonId = record.id;
      people.push(reservationPerson);
    });

    const holderRecord = state.persons.find((p) => p.id === holderPersonId);
    if (!holderRecord) {
      throw new BadRequestException({ code: 'HOLDER_REQUIRED', message: 'Falta el titular.' });
    }
    if (user.role === 'socio' && holderPersonId !== user.personId) {
      throw new ForbiddenException({
        code: 'HOLDER_MISMATCH',
        message: 'El titular debe ser el socio autenticado.',
      });
    }
    const holderUser = state.users.find((u) => u.personId === holderPersonId && u.active);
    return { people, holderPersonId, holderUserId: holderUser?.id };
  }

  private assertSlotOpen(slot: SlotConfig, date: string): void {
    const startsAt = isoFor(date, slot.start);
    const endsAt = isoFor(date, slot.end);
    if (Date.parse(endsAt) <= Date.now()) {
      throw new UnprocessableEntityException({
        code: 'SLOT_ENDED',
        message: 'La franja horaria ya finalizó.',
      });
    }
    if (Date.parse(startsAt) < Date.now() - 10 * 60_000) {
      throw new UnprocessableEntityException({
        code: 'SLOT_STARTED',
        message: 'La franja ya comenzó. Elegí otra franja.',
      });
    }
  }

  async create(user: AuthUser, dto: CreateReservationDto, idempotencyKey?: string) {
    const outcome = await this.db.transaction(
      (state) => {
        if (idempotencyKey) {
          const existing = state.idempotency.find((i) => i.key === idempotencyKey);
          if (existing) {
            const reservation = state.reservations.find((r) => r.id === existing.reservationId);
            if (reservation) return { id: reservation.id, replayed: true };
          }
        }
        const date = resolveDate(dto.date);
        assertBookableDate(date, state.settings);
        const slot = slotOf(state.settings, dto.slotId);
        this.assertSlotOpen(slot, date);
        const space = this.spaceByCode(dto.spaceCode);
        if (dto.partySize > (space.capacity ?? 0)) {
          throw new UnprocessableEntityException({
            code: 'CAPACITY_EXCEEDED',
            message: `El espacio admite hasta ${space.capacity} personas.`,
          });
        }
        if (dto.partySize !== dto.people.length) {
          throw new BadRequestException({
            code: 'PEOPLE_COUNT_MISMATCH',
            message: `La reserva es para ${dto.partySize} personas y se informaron ${dto.people.length}.`,
          });
        }

        const people = this.buildPeople(state, user, dto.people, dto.partySize);
        const seatIds = this.allocateSeats(
          state,
          dto.spaceCode,
          date,
          slot.id,
          dto.partySize,
          dto.seatIds,
        );
        const items = this.allocateEquipment(state, date, slot.id, {
          computers: dto.equipment?.computers ?? 0,
          projectors: dto.equipment?.projectors ?? 0,
          whiteboards: dto.equipment?.whiteboards ?? 0,
        });

        const reservation: ReservationRecord = {
          id: randomId('res'),
          code: this.db.nextReservationCode(state, dto.spaceCode, date.slice(0, 4)),
          spaceCode: dto.spaceCode,
          date,
          slotId: slot.id,
          startsAt: isoFor(date, slot.start),
          endsAt: isoFor(date, slot.end),
          status: 'confirmada',
          partySize: dto.partySize,
          holderPersonId: people.holderPersonId,
          holderUserId: people.holderUserId,
          people: people.people,
          seatHolds: seatIds.map((seatId) => ({ seatId, active: true })),
          equipmentAssignmentIds: [],
          notes: dto.notes?.trim(),
          version: 1,
          createdByUserId: user.userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.createAssignments(state, reservation, items);
        state.reservations.push(reservation);
        if (idempotencyKey) {
          state.idempotency.push({
            key: idempotencyKey,
            reservationId: reservation.id,
            createdAt: reservation.createdAt,
          });
        }
        this.db.pushAudit(state, {
          actorUserId: user.userId,
          actorRole: user.role,
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
            equipment: items.map((i) => i.assetTag),
          },
        });
        return { id: reservation.id, replayed: false };
      },
      { type: 'reservation.created' },
    );

    const reservation = this.db.snapshot.reservations.find((r) => r.id === outcome.id);
    if (!reservation) {
      throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'No se encontró la reserva.' });
    }
    return this.detail(reservation, user);
  }

  async update(user: AuthUser, id: string, dto: UpdateReservationDto) {
    await this.db.transaction(
      (state) => {
        const reservation = state.reservations.find((r) => r.id === id);
        if (!reservation) {
          throw new NotFoundException({
            code: 'RESERVATION_NOT_FOUND',
            message: 'La reserva no existe.',
          });
        }
        this.assertCanManage(reservation, user);
        if (reservation.status !== 'confirmada') {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'Solo se pueden editar reservas confirmadas.',
          });
        }
        if (dto.version && dto.version !== reservation.version) {
          throw new ConflictException({
            code: 'VERSION_CONFLICT',
            message: 'La reserva fue modificada por otra persona. Recargá y volvé a intentar.',
          });
        }
        if (this.hasDeliveredEquipment(state, reservation)) {
          throw new ConflictException({
            code: 'EQUIPMENT_DELIVERED',
            message: 'No se puede editar una reserva con equipamiento ya entregado.',
          });
        }

        const date = dto.date ? resolveDate(dto.date) : reservation.date;
        assertBookableDate(date, state.settings);
        const slot = dto.slotId ? slotOf(state.settings, dto.slotId) : slotOf(state.settings, reservation.slotId);
        this.assertSlotOpen(slot, date);
        const partySize = dto.partySize ?? reservation.partySize;
        const spaceCode = reservation.spaceCode;
        const space = this.spaceByCode(spaceCode);
        if (partySize > (space.capacity ?? 0)) {
          throw new UnprocessableEntityException({
            code: 'CAPACITY_EXCEEDED',
            message: `El espacio admite hasta ${space.capacity} personas.`,
          });
        }

        let people: PeopleBuildResult = {
          people: reservation.people,
          holderPersonId: reservation.holderPersonId,
          holderUserId: reservation.holderUserId,
        };
        if (dto.people) {
          people = this.buildPeople(state, user, dto.people, partySize);
        } else if (partySize !== reservation.partySize) {
          throw new BadRequestException({
            code: 'PEOPLE_REQUIRED',
            message: 'Al cambiar la cantidad de personas tenés que informar el listado completo.',
          });
        } else if (user.role === 'socio' && people.holderPersonId !== user.personId) {
          throw new ForbiddenException({
            code: 'HOLDER_MISMATCH',
            message: 'El titular debe ser el socio autenticado.',
          });
        }

        const structureChanged =
          date !== reservation.date ||
          slot.id !== reservation.slotId ||
          partySize !== reservation.partySize ||
          Boolean(dto.seatIds) ||
          Boolean(dto.equipment);
        const before = {
          date: reservation.date,
          slotId: reservation.slotId,
          partySize: reservation.partySize,
          seats: reservation.seatHolds.filter((h) => h.active).map((h) => h.seatId),
          equipment: reservation.equipmentAssignmentIds,
        };

        if (structureChanged) {
          for (const hold of reservation.seatHolds) hold.active = false;
          this.releaseAssignments(state, reservation);
          const seatIds = this.allocateSeats(
            state,
            spaceCode,
            date,
            slot.id,
            partySize,
            dto.seatIds,
            reservation.id,
          );
          const existingCounts = this.equipmentCounts(state, reservation);
          const counts = dto.equipment
            ? {
                computers: dto.equipment.computers ?? 0,
                projectors: dto.equipment.projectors ?? 0,
                whiteboards: dto.equipment.whiteboards ?? 0,
              }
            : existingCounts;
          const items = this.allocateEquipment(state, date, slot.id, counts, reservation.id);
          this.createAssignments(state, reservation, items);
          reservation.seatHolds = seatIds.map((seatId) => ({ seatId, active: true }));
        }

        reservation.date = date;
        reservation.slotId = slot.id;
        reservation.startsAt = isoFor(date, slot.start);
        reservation.endsAt = isoFor(date, slot.end);
        reservation.partySize = partySize;
        reservation.people = people.people;
        reservation.holderPersonId = people.holderPersonId;
        reservation.holderUserId = people.holderUserId;
        reservation.notes = dto.notes !== undefined ? dto.notes.trim() : reservation.notes;
        reservation.version += 1;
        reservation.updatedAt = new Date().toISOString();

        this.db.pushAudit(state, {
          actorUserId: user.userId,
          actorRole: user.role,
          action: 'reserva.actualizada',
          entityType: 'reservation',
          entityId: reservation.id,
          before,
          after: {
            date: reservation.date,
            slotId: reservation.slotId,
            partySize: reservation.partySize,
            seats: reservation.seatHolds.filter((h) => h.active).map((h) => h.seatId),
            equipment: reservation.equipmentAssignmentIds,
          },
        });
      },
      { type: 'reservation.updated', reservationId: id },
    );
    const updated = this.db.snapshot.reservations.find((r) => r.id === id)!;
    return this.detail(updated, user);
  }

  async cancel(user: AuthUser, id: string, reason?: string) {
    await this.db.transaction(
      (state) => {
        const reservation = state.reservations.find((r) => r.id === id);
        if (!reservation) {
          throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'La reserva no existe.' });
        }
        this.assertCanManage(reservation, user);
        const allowed = user.role === 'administrador' ? ['confirmada', 'en_curso'] : ['confirmada'];
        if (!allowed.includes(reservation.status)) {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'La reserva ya no se puede cancelar en su estado actual.',
          });
        }
        if (this.hasDeliveredEquipment(state, reservation)) {
          throw new ConflictException({
            code: 'EQUIPMENT_PENDING',
            message: 'Primero registrá la devolución del equipamiento entregado.',
          });
        }
        if (user.role === 'socio') {
          const hours = (Date.parse(reservation.startsAt) - Date.now()) / 3_600_000;
          if (hours < state.settings.cancellationHours) {
            throw new UnprocessableEntityException({
              code: 'CANCELLATION_WINDOW',
              message: `Solo se puede cancelar con ${state.settings.cancellationHours} horas de anticipación.`,
            });
          }
        }
        reservation.status = 'cancelada';
        reservation.cancelledAt = new Date().toISOString();
        reservation.cancellationReason = reason?.trim() || 'Cancelada por el usuario';
        reservation.updatedAt = reservation.cancelledAt;
        reservation.version += 1;
        for (const hold of reservation.seatHolds) hold.active = false;
        this.releaseAssignments(state, reservation);
        this.db.pushAudit(state, {
          actorUserId: user.userId,
          actorRole: user.role,
          action: 'reserva.cancelada',
          entityType: 'reservation',
          entityId: reservation.id,
          after: { code: reservation.code, reason: reservation.cancellationReason },
        });
      },
      { type: 'reservation.cancelled', reservationId: id },
    );
    const updated = this.db.snapshot.reservations.find((r) => r.id === id)!;
    return this.detail(updated, user);
  }

  async checkIn(user: AuthUser, id: string) {
    await this.db.transaction(
      (state) => {
        const reservation = state.reservations.find((r) => r.id === id);
        if (!reservation) {
          throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'La reserva no existe.' });
        }
        if (reservation.status !== 'confirmada') {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'Solo se puede hacer check-in de una reserva confirmada.',
          });
        }
        reservation.status = 'en_curso';
        reservation.checkedInAt = new Date().toISOString();
        reservation.updatedAt = reservation.checkedInAt;
        reservation.version += 1;
        for (const person of reservation.people) person.checkedInAt = reservation.checkedInAt;
        this.db.pushAudit(state, {
          actorUserId: user.userId,
          actorRole: user.role,
          action: 'reserva.check_in',
          entityType: 'reservation',
          entityId: reservation.id,
          after: { code: reservation.code, people: reservation.partySize },
        });
      },
      { type: 'reservation.checked_in', reservationId: id },
    );
    return this.detail(this.db.snapshot.reservations.find((r) => r.id === id)!, user);
  }

  async checkOut(user: AuthUser, id: string) {
    await this.db.transaction(
      (state) => {
        const reservation = state.reservations.find((r) => r.id === id);
        if (!reservation) {
          throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'La reserva no existe.' });
        }
        if (reservation.status !== 'en_curso') {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'Solo se puede hacer check-out de una reserva en curso.',
          });
        }
        if (this.hasDeliveredEquipment(state, reservation)) {
          throw new ConflictException({
            code: 'EQUIPMENT_PENDING',
            message: 'Registrá la devolución del equipamiento antes de finalizar.',
          });
        }
        reservation.status = 'finalizada';
        reservation.checkedOutAt = new Date().toISOString();
        reservation.updatedAt = reservation.checkedOutAt;
        reservation.version += 1;
        for (const person of reservation.people) person.checkedOutAt = reservation.checkedOutAt;
        for (const hold of reservation.seatHolds) hold.active = false;
        for (const assignmentId of reservation.equipmentAssignmentIds) {
          const assignment = state.checkouts.find((c) => c.id === assignmentId);
          if (assignment?.status === 'reservada') assignment.status = 'cancelada';
        }
        this.db.pushAudit(state, {
          actorUserId: user.userId,
          actorRole: user.role,
          action: 'reserva.finalizada',
          entityType: 'reservation',
          entityId: reservation.id,
          after: { code: reservation.code },
        });
      },
      { type: 'reservation.checked_out', reservationId: id },
    );
    return this.detail(this.db.snapshot.reservations.find((r) => r.id === id)!, user);
  }

  async noShow(user: AuthUser, id: string) {
    await this.db.transaction(
      (state) => {
        const reservation = state.reservations.find((r) => r.id === id);
        if (!reservation) {
          throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'La reserva no existe.' });
        }
        if (reservation.status !== 'confirmada') {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'Solo se puede marcar ausencia de una reserva confirmada.',
          });
        }
        reservation.status = 'no_show';
        reservation.updatedAt = new Date().toISOString();
        reservation.version += 1;
        for (const hold of reservation.seatHolds) hold.active = false;
        this.releaseAssignments(state, reservation);
        this.db.pushAudit(state, {
          actorUserId: user.userId,
          actorRole: user.role,
          action: 'reserva.no_show',
          entityType: 'reservation',
          entityId: reservation.id,
          after: { code: reservation.code },
        });
      },
      { type: 'reservation.no_show', reservationId: id },
    );
    return this.detail(this.db.snapshot.reservations.find((r) => r.id === id)!, user);
  }

  getOne(user: AuthUser, id: string) {
    const reservation = this.db.snapshot.reservations.find((r) => r.id === id);
    if (!reservation) {
      throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'La reserva no existe.' });
    }
    this.assertCanView(reservation, user);
    return this.detail(reservation, user);
  }

  list(user: AuthUser, query: ListReservationsQuery) {
    const state = this.db.snapshot;
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const q = query.q?.trim().toLowerCase();

    let items = state.reservations.filter((r) => {
      if (user.role === 'socio' && r.holderUserId !== user.userId) return false;
      if (query.from && r.date < query.from) return false;
      if (query.to && r.date > query.to) return false;
      if (query.space && r.spaceCode !== query.space) return false;
      if (query.status && r.status !== query.status) return false;
      if (q) {
        const holder = holderOf(r);
        const haystack = [
          r.code,
          holder.firstName,
          holder.lastName,
          holder.docLast4,
          ...r.people.map((p) => `${p.firstName} ${p.lastName} ${p.docLast4}`),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (query.equipment) {
        const types = state.checkouts
          .filter((c) => r.equipmentAssignmentIds.includes(c.id) && c.status !== 'cancelada')
          .map((c) => c.type);
        if (query.equipment === 'ninguno') {
          if (types.length > 0) return false;
        } else if (!types.includes(query.equipment as EquipmentType)) {
          return false;
        }
      }
      return true;
    });

    items = items.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    const total = items.length;
    const page = items.slice(offset, offset + limit);
    return {
      items: page.map((r) => this.detail(r, user)),
      total,
      limit,
      offset,
      revision: state.meta.revision,
      serverTime: new Date().toISOString(),
    };
  }

  timeline(user: AuthUser, id: string) {
    const reservation = this.db.snapshot.reservations.find((r) => r.id === id);
    if (!reservation) {
      throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'La reserva no existe.' });
    }
    this.assertCanView(reservation, user);
    const state = this.db.snapshot;
    const ids = new Set([reservation.id, ...reservation.equipmentAssignmentIds]);
    const events = state.audit
      .filter((e) => ids.has(e.entityId))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100)
      .map((e) => {
        const actor = state.users.find((u) => u.id === e.actorUserId);
        const actorPerson = actor ? state.persons.find((p) => p.id === actor.personId) : undefined;
        return {
          id: e.id,
          at: e.at,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          actor: actorPerson ? `${actorPerson.firstName} ${actorPerson.lastName}` : 'Sistema',
          actorRole: e.actorRole,
          detail: user.role === 'socio' ? undefined : { before: e.before, after: e.after },
        };
      });
    return { items: events };
  }

  ics(user: AuthUser, id: string): string {
    const reservation = this.db.snapshot.reservations.find((r) => r.id === id);
    if (!reservation) {
      throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'La reserva no existe.' });
    }
    this.assertCanView(reservation, user);
    const space = this.db.floorplan.spaces.find((s) => s.code === reservation.spaceCode);
    const holder = holderOf(reservation);
    const seats = reservation.seatHolds.filter((h) => h.active).map((h) => h.seatId);
    const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ituzaingo Coworking//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${reservation.id}@coworking.ituzaingo.gob.ar`,
      `DTSTAMP:${fmt(new Date().toISOString())}`,
      `DTSTART:${fmt(reservation.startsAt)}`,
      `DTEND:${fmt(reservation.endsAt)}`,
      `SUMMARY:${space?.name ?? reservation.spaceCode} - ${reservation.code}`,
      `LOCATION:Espacio de Coworking, Ituzaingó`,
      `DESCRIPTION:Titular: ${holder.firstName} ${holder.lastName}\\nPersonas: ${reservation.partySize}\\nAsientos: ${seats.join(', ')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return lines.join('\r\n');
  }

  private assertCanView(reservation: ReservationRecord, user: AuthUser): void {
    if (user.role === 'socio' && reservation.holderUserId !== user.userId) {
      throw new ForbiddenException({
        code: 'RESERVATION_FORBIDDEN',
        message: 'No tenés acceso a esta reserva.',
      });
    }
  }

  private assertCanManage(reservation: ReservationRecord, user: AuthUser): void {
    if (reservation.status === 'cancelada' || reservation.status === 'finalizada' || reservation.status === 'no_show') {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'La reserva ya está cerrada.',
      });
    }
    if (user.role === 'socio' && reservation.holderUserId !== user.userId) {
      throw new ForbiddenException({
        code: 'RESERVATION_FORBIDDEN',
        message: 'No podés modificar una reserva de otra persona.',
      });
    }
  }

  private hasDeliveredEquipment(state: DbState, reservation: ReservationRecord): boolean {
    return state.checkouts.some(
      (c) => reservation.equipmentAssignmentIds.includes(c.id) && c.status === 'entregada',
    );
  }

  private equipmentCounts(
    state: DbState,
    reservation: ReservationRecord,
  ): { computers: number; projectors: number; whiteboards: number } {
    const active = state.checkouts.filter(
      (c) =>
        reservation.equipmentAssignmentIds.includes(c.id) &&
        (c.status === 'reservada' || c.status === 'entregada'),
    );
    return {
      computers: active.filter((c) => c.type === 'computadora').length,
      projectors: active.filter((c) => c.type === 'proyector').length,
      whiteboards: active.filter((c) => c.type === 'pizarra').length,
    };
  }

  private detail(reservation: ReservationRecord, user: AuthUser) {
    const state = this.db.snapshot;
    const space = this.db.floorplan.spaces.find((s) => s.code === reservation.spaceCode);
    const holder = holderOf(reservation);
    const full = user.role !== 'socio' || reservation.holderUserId === user.userId;
    const assignments = state.checkouts.filter((c) => reservation.equipmentAssignmentIds.includes(c.id));
    const assignedSeats = reservation.seatHolds.map((hold) => {
      const furniture = this.db.floorplan.furniture.find((f) => f.seats.some((s) => s.id === hold.seatId));
      const seat = furniture?.seats.find((s) => s.id === hold.seatId);
      return {
        id: hold.seatId,
        active: hold.active,
        furnitureCode: furniture?.code,
        furnitureLabel: furniture?.label,
        spaceCode: furniture?.spaceCode,
        index: seat?.index,
      };
    });
    const equipment = assignments.map((assignment) => {
      const item = state.gear.find((g) => g.id === assignment.itemId);
      const required = REQUIRED_ACCESSORIES[assignment.type];
      return {
        assignmentId: assignment.id,
        itemId: assignment.itemId,
        assetTag: assignment.assetTag,
        type: assignment.type,
        model: item?.model,
        serial: item?.serial,
        status: assignment.status,
        requiredAccessories: required.map((code) => ({
          code,
          label: ACCESSORY_LABELS[code as AccessoryCode],
          present: item?.accessories[code] ?? false,
        })),
        delivery: assignment.delivery,
        returned: assignment.returned,
        incident: assignment.incident,
      };
    });
    const hoursToStart = (Date.parse(reservation.startsAt) - Date.now()) / 3_600_000;
    const canCancel =
      (reservation.status === 'confirmada' || (user.role === 'administrador' && reservation.status === 'en_curso')) &&
      (user.role === 'administrador' || (reservation.holderUserId === user.userId && hoursToStart >= state.settings.cancellationHours)) &&
      !this.hasDeliveredEquipment(state, reservation);
    return {
      id: reservation.id,
      code: reservation.code,
      space: {
        code: reservation.spaceCode,
        name: space?.name ?? reservation.spaceCode,
        color: space?.color,
      },
      date: reservation.date,
      slot: {
        id: reservation.slotId,
        label: slotLabel(state.settings, reservation.slotId, reservation.startsAt, reservation.endsAt),
      },
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      status: reservation.status,
      partySize: reservation.partySize,
      companionsCount: reservation.partySize - 1,
      holder: {
        displayName: displayName(holder, full),
        firstName: holder.firstName,
        lastName: holder.lastName,
        docType: holder.docType,
        docLast4: holder.docLast4,
      },
      people: reservation.people.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        role: p.role,
        docType: p.docType,
        docLast4: p.docLast4,
        checkedInAt: p.checkedInAt,
        checkedOutAt: p.checkedOutAt,
      })),
      seats: assignedSeats,
      equipment,
      notes: reservation.notes,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
      checkedInAt: reservation.checkedInAt,
      checkedOutAt: reservation.checkedOutAt,
      cancelledAt: reservation.cancelledAt,
      cancellationReason: reservation.cancellationReason,
      version: reservation.version,
      isMine: reservation.holderUserId === user.userId,
      actions: {
        canEdit:
          reservation.status === 'confirmada' &&
          (user.role === 'administrador' || reservation.holderUserId === user.userId) &&
          !this.hasDeliveredEquipment(state, reservation),
        canCancel,
        canCheckIn: user.role === 'administrador' && reservation.status === 'confirmada',
        canCheckOut: user.role === 'administrador' && reservation.status === 'en_curso',
        canNoShow: user.role === 'administrador' && reservation.status === 'confirmada',
        canDeliver:
          user.role === 'administrador' &&
          (reservation.status === 'confirmada' || reservation.status === 'en_curso') &&
          equipment.some((e) => e.status === 'reservada'),
        canReturn:
          user.role === 'administrador' && equipment.some((e) => e.status === 'entregada'),
      },
    };
  }
}
