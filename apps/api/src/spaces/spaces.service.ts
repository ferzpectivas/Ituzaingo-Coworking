import { Injectable, NotFoundException } from '@nestjs/common';
import { JsonDbService } from '../storage/json-db.service';
import type { AuthUser } from '../common/auth-user';
import { displayName, holderOf, isFullView } from '../common/serializers';
import { currentSlot, isOpenDate, nextOpenDate as computeNextOpenDate, resolveDate, slotOf } from '../common/slots';
import { todayISO } from '../common/time';
import type {
  EquipmentAssignmentRecord,
  EquipmentType,
  ReservationRecord,
} from '../storage/types';

@Injectable()
export class SpacesService {
  constructor(private readonly db: JsonDbService) {}

  getConfig() {
    const state = this.db.snapshot;
    const today = todayISO();
    return {
      settings: state.settings,
      spaces: this.db.floorplan.spaces,
      today,
      todayOpen: isOpenDate(today, state.settings),
      nextOpenDate: computeNextOpenDate(today, state.settings),
      currentSlotId: currentSlot(state.settings).id,
      revision: state.meta.revision,
    };
  }

  getFloorplan() {
    return this.db.floorplan;
  }

  getSpaces() {
    const state = this.db.snapshot;
    return this.db.floorplan.spaces.map((space) => {
      const today = todayISO();
      const open = isOpenDate(today, state.settings);
      const slot = currentSlot(state.settings);
      const occupied = new Set<string>();
      for (const reservation of state.reservations) {
        if (
          open &&
          reservation.spaceCode === space.code &&
          reservation.date === today &&
          reservation.slotId === slot.id &&
          reservation.status !== 'cancelada' &&
          reservation.status !== 'no_show'
        ) {
          for (const hold of reservation.seatHolds.filter((h) => h.active)) occupied.add(hold.seatId);
        }
      }
      return {
        ...space,
        occupiedSeats: occupied.size,
        freeSeats: Math.max(0, (space.capacity ?? 0) - occupied.size),
      };
    });
  }

  getSpace(code: string) {
    const space = this.db.floorplan.spaces.find((s) => s.code === code);
    if (!space) {
      throw new NotFoundException({ code: 'SPACE_NOT_FOUND', message: 'El espacio no existe.' });
    }
    return {
      ...space,
      furniture: this.db.floorplan.furniture.filter((f) => f.spaceCode === code),
    };
  }

  getOccupancy(user: AuthUser, dateInput?: string, slotId?: string) {
    const state = this.db.snapshot;
    const date = resolveDate(dateInput);
    const slot = slotOf(state.settings, slotId);
    const closed = !isOpenDate(date, state.settings);
    const reservations = closed
      ? []
      : state.reservations.filter(
          (r) =>
            r.date === date &&
            r.slotId === slot.id &&
            r.status !== 'cancelada' &&
            r.status !== 'no_show',
        );

    const seatOwner = new Map<string, ReservationRecord>();
    for (const reservation of reservations) {
      for (const hold of reservation.seatHolds.filter((h) => h.active)) {
        seatOwner.set(hold.seatId, reservation);
      }
    }

    const spaces = this.db.floorplan.spaces
      .filter((space) => space.bookable)
      .map((space) => {
        const units = this.db.floorplan.furniture.filter((f) => f.spaceCode === space.code);
        let occupiedSeats = 0;
        const furniture = units.map((unit) => {
          const seatStatus: Record<string, 'libre' | 'ocupado' | 'mio'> = {};
          let unitOccupied = 0;
          for (const seat of unit.seats) {
            const reservation = seatOwner.get(seat.id);
            if (!reservation) {
              seatStatus[seat.id] = 'libre';
            } else {
              unitOccupied += 1;
              seatStatus[seat.id] = reservation.holderUserId === user.userId ? 'mio' : 'ocupado';
            }
          }
          occupiedSeats += unitOccupied;
          return {
            code: unit.code,
            label: unit.label,
            kind: unit.kind,
            capacity: unit.capacity,
            occupiedSeats: unitOccupied,
            freeSeats: unit.capacity - unitOccupied,
            status:
              unitOccupied === 0 ? 'libre' : unitOccupied >= unit.capacity ? 'completo' : 'parcial',
            seatStatus,
          };
        });

        const spaceReservations = reservations
          .filter((r) => r.spaceCode === space.code)
          .map((r) => this.mapReservation(r, user, state.checkouts));

        return {
          code: space.code,
          name: space.name,
          description: space.description,
          color: space.color,
          accent: space.accent,
          capacity: space.capacity,
          occupiedSeats,
          freeSeats: Math.max(0, (space.capacity ?? 0) - occupiedSeats),
          bounds: space.bounds,
          centroid: space.centroid,
          furniture,
          reservations: spaceReservations,
        };
      });

    return {
      generatedAt: new Date().toISOString(),
      revision: state.meta.revision,
      date,
      slot,
      closed,
      timezone: state.settings.timezone,
      totals: {
        capacity: spaces.reduce((acc, s) => acc + (s.capacity ?? 0), 0),
        occupiedSeats: spaces.reduce((acc, s) => acc + s.occupiedSeats, 0),
        reservations: reservations.length,
        people: reservations.reduce((acc, r) => acc + r.partySize, 0),
      },
      spaces,
    };
  }

  private mapReservation(
    reservation: ReservationRecord,
    user: AuthUser,
    checkouts: EquipmentAssignmentRecord[],
  ) {
    const full = isFullView(user, reservation);
    const holder = holderOf(reservation);
    const activeAssignments = checkouts.filter(
      (c) =>
        reservation.equipmentAssignmentIds.includes(c.id) &&
        (c.status === 'reservada' || c.status === 'entregada'),
    );
    const furnitureCodes = new Set<string>();
    const seatIds = reservation.seatHolds.filter((h) => h.active).map((h) => h.seatId);
    for (const seatId of seatIds) {
      const unit = this.db.floorplan.furniture.find((f) => f.seats.some((s) => s.id === seatId));
      if (unit) furnitureCodes.add(unit.code);
    }
    return {
      id: reservation.id,
      code: reservation.code,
      holder: {
        displayName: displayName(holder, full),
        firstName: holder.firstName,
        lastName: holder.lastName,
      },
      people: full
        ? reservation.people.map((p) => ({
            firstName: p.firstName,
            lastName: p.lastName,
            role: p.role,
            docLast4: p.docLast4,
          }))
        : undefined,
      companionsCount: reservation.partySize - 1,
      peopleCount: reservation.partySize,
      seatIds,
      furnitureCodes: [...furnitureCodes],
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      status: reservation.status,
      notes: reservation.notes,
      equipment: {
        computers: activeAssignments.filter((c) => c.type === 'computadora').length,
        projectors: activeAssignments.filter((c) => c.type === 'proyector').length,
      },
      isMine: reservation.holderUserId === user.userId,
    };
  }

  getAvailability(
    user: AuthUser,
    options: { spaceCode?: string; date?: string; slotId?: string; partySize?: number },
  ) {
    const state = this.db.snapshot;
    const date = resolveDate(options.date);
    const slot = slotOf(state.settings, options.slotId);
    if (!isOpenDate(date, state.settings)) {
      return {
        date,
        slot,
        closed: true,
        spaces: [],
        equipment: [],
        revision: state.meta.revision,
        generatedAt: new Date().toISOString(),
      };
    }
    const activeReservations = state.reservations.filter(
      (r) =>
        r.date === date &&
        r.slotId === slot.id &&
        r.status !== 'cancelada' &&
        r.status !== 'no_show',
    );
    const occupied = new Set<string>();
    for (const r of activeReservations) {
      for (const hold of r.seatHolds.filter((h) => h.active)) occupied.add(hold.seatId);
    }

    const spaces = this.db.floorplan.spaces
      .filter((s) => s.bookable && (!options.spaceCode || s.code === options.spaceCode))
      .map((space) => {
        const units = this.db.floorplan.furniture.filter((f) => f.spaceCode === space.code);
        const furniture = units.map((unit) => {
          const seats = unit.seats.map((seat) => ({
            id: seat.id,
            index: seat.index,
            status: occupied.has(seat.id) ? 'ocupado' : 'libre',
          }));
          const free = seats.filter((s) => s.status === 'libre').length;
          return {
            code: unit.code,
            label: unit.label,
            kind: unit.kind,
            capacity: unit.capacity,
            freeSeats: free,
            seats,
          };
        });
        const capacity = units.reduce((acc, u) => acc + u.capacity, 0);
        const occupiedSeats = units.reduce(
          (acc, u) => acc + u.seats.filter((s) => occupied.has(s.id)).length,
          0,
        );
        return {
          code: space.code,
          name: space.name,
          capacity,
          occupiedSeats,
          freeSeats: capacity - occupiedSeats,
          fitsParty: options.partySize ? capacity - occupiedSeats >= options.partySize : undefined,
          furniture,
        };
      });

    const activeAssignments = state.checkouts.filter(
      (c) =>
        c.date === date &&
        c.slotId === slot.id &&
        (c.status === 'reservada' || c.status === 'entregada'),
    );
    const equipment = (['computadora', 'proyector'] as EquipmentType[]).map((type) => {
      const items = state.gear.filter((g) => g.type === type && g.status !== 'mantenimiento');
      const used = new Set(
        activeAssignments.filter((a) => a.type === type).map((a) => a.itemId),
      );
      const available = items.filter((i) => !used.has(i.id));
      return {
        type,
        total: items.length,
        available: available.length,
        items: available.map((i) => ({
          id: i.id,
          assetTag: i.assetTag,
          model: i.model,
          accessories: i.accessories,
        })),
      };
    });

    return {
      date,
      slot,
      closed: false,
      spaces,
      equipment,
      revision: state.meta.revision,
      generatedAt: new Date().toISOString(),
    };
  }
}
