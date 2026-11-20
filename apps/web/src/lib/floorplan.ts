import type { Floorplan, Furniture, Occupancy, Opening, Space, WallBox } from './types';

export function spaceByCode(floorplan: Floorplan, code: string): Space | undefined {
  return floorplan.spaces.find((space) => space.code === code);
}

export function furnitureByCode(floorplan: Floorplan, code: string): Furniture | undefined {
  return floorplan.furniture.find((unit) => unit.code === code);
}

export function seatPosition(floorplan: Floorplan, seatId: string): { x: number; z: number } | undefined {
  for (const unit of floorplan.furniture) {
    const seat = unit.seats.find((item) => item.id === seatId);
    if (seat) return seat.position;
  }
  return undefined;
}

export function seatFor(floorplan: Floorplan, seatId: string): Furniture | undefined {
  return floorplan.furniture.find((unit) => unit.seats.some((seat) => seat.id === seatId));
}

export function occupancyForSeat(
  occupancy: Occupancy | null,
  seatId: string,
): { status: 'libre' | 'ocupado' | 'mio'; holder?: string; companions?: number; reservationId?: string } {
  if (!occupancy) return { status: 'libre' };
  for (const space of occupancy.spaces) {
    for (const unit of space.furniture) {
      const status = unit.seatStatus[seatId];
      if (!status) continue;
      const reservation = space.reservations.find((item) => item.seatIds.includes(seatId));
      return {
        status,
        holder: reservation?.holder.displayName,
        companions: reservation?.companionsCount,
        reservationId: reservation?.id,
      };
    }
  }
  return { status: 'libre' };
}

export function spaceAccent(space: Space): string {
  return space.accent;
}

export function svgPointToWorld(x: number, y: number, floorplan: Floorplan): { x: number; z: number } {
  return {
    x: (x - floorplan.origin.x) * floorplan.scale,
    z: (y - floorplan.origin.y) * floorplan.scale,
  };
}

export function wallKey(wall: WallBox): string {
  return `${wall.x}:${wall.z}:${wall.width}:${wall.depth}:${wall.y}:${wall.height}`;
}

export function openingKey(opening: Opening): string {
  return `${opening.type}:${opening.x1}:${opening.z1}:${opening.x2}:${opening.z2}`;
}

export const SPACE_NUMBERS: Record<string, string> = {
  coworking: '1',
  salon: '2',
  'sala-reuniones': '3',
  acceso: '·',
};
