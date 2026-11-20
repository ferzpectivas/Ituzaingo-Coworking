'use client';

import type { Floorplan, Occupancy } from '@/lib/types';

const SEAT_FILL: Record<string, string> = {
  libre: '#8fbfb2',
  ocupado: '#c56a6a',
  mio: '#c9a66b',
};

const FLOOR_FILL: Record<string, string> = {
  coworking: '#eef6f4',
  salon: '#faf4e9',
  'sala-reuniones': '#edf3fb',
  acceso: '#f1f3ef',
};

export function Floorplan2D({
  floorplan,
  occupancy,
  selectedSpace,
  onSelectSpace,
  showSeats = true,
  className,
}: {
  floorplan: Floorplan;
  occupancy?: Occupancy | null;
  selectedSpace?: string | null;
  onSelectSpace?: (code: string) => void;
  showSeats?: boolean;
  className?: string;
}) {
  const seatStatus = new Map<string, { status: string; holder?: string; companions?: number }>();
  if (occupancy) {
    for (const space of occupancy.spaces) {
      for (const unit of space.furniture) {
        for (const [seatId, status] of Object.entries(unit.seatStatus)) {
          const reservation = space.reservations.find((item) => item.seatIds.includes(seatId));
          seatStatus.set(seatId, {
            status,
            holder: reservation?.holder.displayName,
            companions: reservation?.companionsCount,
          });
        }
      }
    }
  } else {
    for (const unit of floorplan.furniture) {
      for (const seat of unit.seats) seatStatus.set(seat.id, { status: 'libre' });
    }
  }

  return (
    <svg
      viewBox={`-0.3 -0.3 ${floorplan.bounds.width + 0.6} ${floorplan.bounds.depth + 0.6}`}
      className={className}
      role="img"
      aria-label="Plano del Espacio de Coworking de Ituzaingó"
    >
      <defs>
        <pattern id="piso-acceso" width="0.2" height="0.2" patternUnits="userSpaceOnUse">
          <rect width="0.2" height="0.2" fill="#f1f3ef" />
          <path d="M0 0.2L0.2 0" stroke="#e3e8e1" strokeWidth="0.012" />
        </pattern>
      </defs>

      <rect
        x={-0.3}
        y={-0.3}
        width={floorplan.bounds.width + 0.6}
        height={floorplan.bounds.depth + 0.6}
        fill="#f7f8f6"
        rx={0.2}
      />

      {floorplan.spaces.map((space) => {
        const selected = selectedSpace === space.code;
        const interactive = Boolean(onSelectSpace) && space.bookable;
        return (
          <g
            key={space.code}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={
              interactive
                ? `Seleccionar ${space.name}, capacidad ${space.capacity} personas`
                : space.name
            }
            onClick={() => interactive && onSelectSpace?.(space.code)}
            onKeyDown={(event) => {
              if (!interactive) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectSpace?.(space.code);
              }
            }}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            <rect
              x={space.bounds.x}
              y={space.bounds.z}
              width={space.bounds.width}
              height={space.bounds.depth}
              fill={space.code === 'acceso' ? 'url(#piso-acceso)' : FLOOR_FILL[space.code] ?? space.accent}
              stroke={selected ? space.color : '#d9dfd8'}
              strokeWidth={selected ? 0.09 : 0.02}
              rx={0.05}
            />
            <text
              x={space.labelPosition.x}
              y={space.labelPosition.z + 0.02}
              fontSize={0.2}
              fontWeight={700}
              fill={space.color}
              fontFamily="Inter Variable, sans-serif"
            >
              {space.number > 0 ? `${space.number} · ` : ''}
              {space.name}
            </text>
            {space.bookable ? (
              <text
                x={space.labelPosition.x}
                y={space.labelPosition.z + 0.22}
                fontSize={0.13}
                fill="#5a6a66"
                fontFamily="Inter Variable, sans-serif"
              >
                {space.capacity} puestos · {space.furnitureCount} muebles
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Muros */}
      {floorplan.walls.map((wall, index) => (
        <line
          key={`wall-${index}`}
          x1={wall.x1}
          y1={wall.z1}
          x2={wall.x2}
          y2={wall.z2}
          stroke="#727d76"
          strokeWidth={0.055}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}

      {/* Aberturas */}
      {floorplan.openings.map((opening, index) =>
        opening.glass ? (
          <line
            key={`opening-${index}`}
            x1={opening.x1}
            y1={opening.z1}
            x2={opening.x2}
            y2={opening.z2}
            stroke="#8fb3c9"
            strokeWidth={0.075}
            strokeLinecap="round"
          />
        ) : (
          <line
            key={`opening-${index}`}
            x1={opening.x1}
            y1={opening.z1}
            x2={opening.x2}
            y2={opening.z2}
            stroke="#f7f8f6"
            strokeWidth={0.09}
            strokeLinecap="round"
          />
        ),
      )}

      {/* Elementos fijos (pizarra del aula) */}
      {floorplan.decor.map((item, index) =>
        item.type === 'whiteboard' ? (
          <g key={`decor-${index}`}>
            <title>Pizarra</title>
            <rect
              x={item.position.x - (item.size?.width ?? 0.06) / 2}
              y={item.position.z - (item.size?.depth ?? 2.2) / 2}
              width={item.size?.width ?? 0.06}
              height={item.size?.depth ?? 2.2}
              rx={0.015}
              fill="#ffffff"
              stroke="#3c4743"
              strokeWidth={0.02}
            />
          </g>
        ) : null,
      )}

      {/* Mobiliario */}
      {floorplan.furniture.map((unit) => (
        <g key={unit.code}>
          <rect
            x={unit.position.x - unit.size.width / 2}
            y={unit.position.z - unit.size.depth / 2}
            width={unit.size.width}
            height={unit.size.depth}
            rx={unit.kind === 'pupitre' ? 0.04 : 0.07}
            fill={unit.kind === 'pupitre' ? '#d98b8b' : unit.kind === 'mesa_ejecutiva' ? '#c19a76' : '#d3ae8d'}
            stroke={unit.kind === 'pupitre' ? '#b4484a' : '#9a6a48'}
            strokeWidth={0.018}
          />
          <text
            x={unit.position.x}
            y={unit.position.z + 0.04}
            fontSize={0.11}
            textAnchor="middle"
            fill="#40352c"
            fontWeight={600}
            fontFamily="Inter Variable, sans-serif"
            style={{ pointerEvents: 'none' }}
          >
            {unit.label}
          </text>
          {showSeats
            ? unit.seats.map((seat) => {
                const info = seatStatus.get(seat.id);
                const status = info?.status ?? 'libre';
                const color = SEAT_FILL[status] ?? SEAT_FILL.libre;
                const label = `${unit.label} · Asiento ${seat.index}: ${
                  status === 'libre' ? 'libre' : info?.holder ?? 'ocupado'
                }`;
                return (
                  <g key={seat.id}>
                    <title>{label}</title>
                    <circle
                      cx={seat.position.x}
                      cy={seat.position.z}
                      r={0.085}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={0.014}
                    />
                  </g>
                );
              })
            : null}
        </g>
      ))}
    </svg>
  );
}
