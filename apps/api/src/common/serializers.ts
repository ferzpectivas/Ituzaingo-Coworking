import type { ReservationPerson, ReservationRecord } from '../storage/types';
import type { AuthUser } from './auth-user';

export function isFullView(viewer: AuthUser, reservation: ReservationRecord): boolean {
  return viewer.role !== 'socio' || reservation.holderUserId === viewer.userId;
}

export function displayName(person: ReservationPerson, full: boolean): string {
  return full
    ? `${person.firstName} ${person.lastName}`
    : `${person.firstName} ${person.lastName.slice(0, 1)}.`;
}

export function holderOf(reservation: ReservationRecord): ReservationPerson {
  return (
    reservation.people.find((p) => p.personId === reservation.holderPersonId) ??
    reservation.people[0]
  );
}

export function seatFurnitureMap(furniture: Array<{ code: string; seats: Array<{ id: string }> }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const unit of furniture) {
    for (const seat of unit.seats) map.set(seat.id, unit.code);
  }
  return map;
}
