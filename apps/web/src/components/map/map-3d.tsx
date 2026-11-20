'use client';

import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Floorplan, Occupancy, Seat } from '@/lib/types';

type SeatStatus = 'libre' | 'ocupado' | 'mio';

interface SeatInfo {
  status: SeatStatus;
  holder?: string;
  companions?: number;
  unitLabel: string;
  unitCode: string;
  reservationId?: string;
}

interface HoverState {
  seat: Seat;
  unitCode: string;
  unitLabel: string;
  spaceName: string;
  info: SeatInfo;
  pinned: boolean;
}

const STATUS_COLORS: Record<SeatStatus, string> = {
  libre: '#8fbfb2',
  ocupado: '#c56a6a',
  mio: '#c9a66b',
};

const FLOOR_COLORS: Record<string, string> = {
  coworking: '#e6f2f0',
  salon: '#f6efe3',
  'sala-reuniones': '#e8f0fa',
  acceso: '#eef1ee',
};

const deg = (value: number) => (value * Math.PI) / 180;

// Altura de corte de la maqueta: los muros se muestran a media altura para
// poder ver el interior del plano.
const WALL_CUT = 0.42;

function Chair({
  seat,
  color,
  hovered,
  compact,
  onHover,
  onLeave,
  onPin,
}: {
  seat: Seat;
  color: string;
  hovered: boolean;
  compact?: boolean;
  onHover: () => void;
  onLeave: () => void;
  onPin: () => void;
}) {
  const y = 0.02;
  const seatSize = compact ? 0.34 : 0.38;
  const backHeight = compact ? 0.24 : 0.4;
  const backY = compact ? 0.56 : 0.63;
  const backZ = compact ? -0.15 : -0.17;
  return (
    <group
      position={[seat.position.x, y, seat.position.z]}
      rotation-y={deg(seat.rotationY)}
      scale={hovered ? 1.22 : 1}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover();
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onLeave();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onPin();
      }}
    >
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[seatSize, 0.08, seatSize]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, backY, backZ]} castShadow>
        <boxGeometry args={[seatSize, backHeight, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.42, 8]} />
        <meshStandardMaterial color="#5d6663" roughness={0.7} />
      </mesh>
    </group>
  );
}

function TableShell({
  width,
  depth,
  color,
  executive,
}: {
  width: number;
  depth: number;
  color: string;
  executive?: boolean;
}) {
  const legX = Math.max(0.25, width / 2 - 0.12);
  const legZ = Math.max(0.25, depth / 2 - 0.12);
  return (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
      </mesh>
      {executive ? (
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[width * 0.55, 0.42, depth * 0.55]} />
          <meshStandardMaterial color="#8f5d3f" roughness={0.6} />
        </mesh>
      ) : null}
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, 0.37, z]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.72, 8]} />
          <meshStandardMaterial color="#4d4a45" roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

export function Map3D({
  floorplan,
  occupancy,
  selectedSpace,
  onSelectSpace,
  className,
}: {
  floorplan: Floorplan;
  occupancy: Occupancy | null;
  selectedSpace?: string | null;
  onSelectSpace?: (code: string) => void;
  className?: string;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  const seatInfo = useMemo(() => {
    const map = new Map<string, SeatInfo>();
    if (!occupancy) {
      for (const unit of floorplan.furniture) {
        for (const seat of unit.seats) {
          map.set(seat.id, {
            status: 'libre',
            unitLabel: unit.label,
            unitCode: unit.code,
          });
        }
      }
      return map;
    }
    for (const space of occupancy.spaces) {
      for (const unit of space.furniture) {
        for (const [seatId, status] of Object.entries(unit.seatStatus)) {
          const reservation = space.reservations.find((item) => item.seatIds.includes(seatId));
          map.set(seatId, {
            status,
            holder: reservation?.holder.displayName,
            companions: reservation?.companionsCount,
            unitLabel: unit.label,
            unitCode: unit.code,
            reservationId: reservation?.id,
          });
        }
      }
    }
    return map;
  }, [occupancy, floorplan.furniture]);

  const center = { x: floorplan.bounds.width / 2, z: floorplan.bounds.depth / 2 };
  const wallColor = '#e7ebe4';
  const wallTop = '#d2d9d0';

  const showHover = (state: HoverState) => {
    const key = `${state.seat.id}`;
    setHover(state);
    setPinnedKey((current) => (current === key ? key : current));
  };

  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 1.8]}
        camera={{ position: [center.x + 7.2, 11.5, center.z + 12.5], fov: 34, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => setPinnedKey(null)}
      >
        <color attach="background" args={['#f2f5f0']} />
        <fog attach="fog" args={['#f2f5f0', 22, 44]} />
        <ambientLight intensity={1.15} />
        <hemisphereLight args={['#ffffff', '#cfd8ce', 1.1]} />
        <directionalLight
          position={[center.x + 6, 15, center.z + 8]}
          intensity={2.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-bias={-0.0006}
        />
        <OrbitControls
          makeDefault
          target={[center.x, 0.3, center.z]}
          minDistance={6}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.12}
          minPolarAngle={0.25}
          enablePan
          panSpeed={0.7}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
        />

        <ContactShadows
          position={[center.x, 0.005, center.z]}
          opacity={0.28}
          scale={26}
          blur={2.6}
          far={9}
          color="#3d4a44"
        />

        {/* Losa base */}
        <mesh position={[center.x, -0.1, center.z]} receiveShadow>
          <boxGeometry args={[floorplan.bounds.width + 0.4, 0.2, floorplan.bounds.depth + 0.4]} />
          <meshStandardMaterial color="#e9ede6" roughness={0.95} />
        </mesh>

        {/* Pisos por ambiente */}
        {floorplan.spaces.map((space) => {
          const isSelected = selectedSpace === space.code;
          return (
            <mesh
              key={space.code}
              position={[space.bounds.x + space.bounds.width / 2, 0.002, space.bounds.z + space.bounds.depth / 2]}
              rotation-x={-Math.PI / 2}
              receiveShadow
              onClick={(event) => {
                event.stopPropagation();
                if (space.bookable) onSelectSpace?.(space.code);
              }}
            >
              <planeGeometry args={[space.bounds.width - 0.04, space.bounds.depth - 0.04]} />
              <meshStandardMaterial
                color={FLOOR_COLORS[space.code] ?? space.accent}
                roughness={0.96}
                emissive={isSelected ? new THREE.Color(space.color) : new THREE.Color('#000000')}
                emissiveIntensity={isSelected ? 0.12 : 0}
              />
            </mesh>
          );
        })}

        {/* Muros en formato maqueta */}
        {floorplan.wallBoxes
          .filter((box) => box.kind === 'wall')
          .map((box, index) => (
            <mesh
              key={`wall-${index}`}
              position={[box.x, (box.height * WALL_CUT) / 2, box.z]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[box.width, box.height * WALL_CUT, box.depth]} />
              <meshStandardMaterial color={wallColor} roughness={0.9} />
            </mesh>
          ))}

        {/* Remate superior de muros */}
        {floorplan.wallBoxes
          .filter((box) => box.kind === 'wall')
          .map((box, index) => (
            <mesh key={`cap-${index}`} position={[box.x, box.height * WALL_CUT + 0.012, box.z]}>
              <boxGeometry args={[box.width + 0.005, 0.024, box.depth + 0.005]} />
              <meshStandardMaterial color={wallTop} roughness={0.8} />
            </mesh>
          ))}

        {/* Vidrios de aberturas (recortados a la altura de la maqueta) */}
        {floorplan.openings
          .filter((opening) => opening.glass)
          .map((opening, index) => {
            const horizontal = opening.axis === 'h';
            const length = Math.abs(horizontal ? opening.x2 - opening.x1 : opening.z2 - opening.z1);
            const midX = (opening.x1 + opening.x2) / 2;
            const midZ = (opening.z1 + opening.z2) / 2;
            const top = Math.min(opening.y1, floorplan.wallHeight * WALL_CUT);
            const bottom = Math.min(opening.y0, top);
            return (
              <mesh key={`glass-${index}`} position={[midX, (bottom + top) / 2, midZ]}>
                <boxGeometry
                  args={horizontal ? [length, top - bottom, 0.03] : [0.03, top - bottom, length]}
                />
                <meshStandardMaterial
                  color="#b7d4dd"
                  transparent
                  opacity={0.4}
                  roughness={0.15}
                  metalness={0.1}
                />
              </mesh>
            );
          })}

        {/* Mobiliario y asientos */}
        {floorplan.furniture.map((unit) => {
          const seatInfoByUnit = unit.seats.map((seat) => ({
            seat,
            relative: {
              ...seat,
              position: {
                x: seat.position.x - unit.position.x,
                z: seat.position.z - unit.position.z,
              },
            },
            info: seatInfo.get(seat.id),
          }));
          return (
            <group key={unit.code} position={[unit.position.x, 0, unit.position.z]}>
              {unit.kind === 'pupitre' ? (
                <>
                  <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
                    <boxGeometry args={[unit.size.width, 0.055, unit.size.depth]} />
                    <meshStandardMaterial color="#b4484a" roughness={0.5} />
                  </mesh>
                  <mesh position={[0, 0.55, unit.size.depth / 2 - 0.03]} castShadow>
                    <boxGeometry args={[unit.size.width, 0.3, 0.04]} />
                    <meshStandardMaterial color="#9e3f41" roughness={0.6} />
                  </mesh>
                  {[-1, 1].map((side) => (
                    <mesh key={side} position={[(side * unit.size.width) / 2 - side * 0.08, 0.37, 0]}>
                      <boxGeometry args={[0.035, 0.72, unit.size.depth * 0.8]} />
                      <meshStandardMaterial color="#575d59" roughness={0.7} />
                    </mesh>
                  ))}
                </>
              ) : (
                <TableShell
                  width={unit.size.width}
                  depth={unit.size.depth}
                  color={unit.kind === 'mesa_ejecutiva' ? '#8a5b3d' : '#a9744f'}
                  executive={unit.kind === 'mesa_ejecutiva'}
                />
              )}
              {seatInfoByUnit.map(({ seat, relative, info }) => {
                const status = info?.status ?? 'libre';
                const key = `${seat.id}`;
                const isHovered = hover?.seat.id === seat.id || pinnedKey === key;
                const absoluteSeat: Seat = {
                  ...seat,
                  position: {
                    x: unit.position.x + relative.position.x,
                    z: unit.position.z + relative.position.z,
                  },
                };
                const stateForHover = (pinned: boolean): HoverState => ({
                  seat: absoluteSeat,
                  unitCode: unit.code,
                  unitLabel: unit.label,
                  spaceName: unit.spaceCode,
                  info: info ?? { status, unitCode: unit.code, unitLabel: unit.label },
                  pinned,
                });
                return (
                  <Chair
                    key={seat.id}
                    seat={relative}
                    color={STATUS_COLORS[status]}
                    hovered={isHovered}
                    compact={unit.kind === 'pupitre'}
                    onHover={() => showHover(stateForHover(false))}
                    onLeave={() => {
                      if (pinnedKey !== key) setHover(null);
                    }}
                    onPin={() => {
                      const nextPinned = pinnedKey === key ? null : key;
                      setPinnedKey(nextPinned);
                      setHover(nextPinned ? stateForHover(true) : null);
                    }}
                  />
                );
              })}
            </group>
          );
        })}

        {/* Etiquetas de ambientes */}
        {floorplan.spaces
          .filter((space) => space.bookable)
          .map((space) => (
            <Html
              key={`label-${space.code}`}
              position={[space.labelPosition.x, 0.03, space.labelPosition.z]}
              center
              distanceFactor={13}
              zIndexRange={[5, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <div className="select-none whitespace-nowrap rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[10px] font-semibold tracking-wide text-ink shadow-sm backdrop-blur">
                <span className="mr-1 text-teal">{space.number}</span>
                {space.name}
              </div>
            </Html>
          ))}

        {/* Elementos fijos: pizarra montada sobre el muro oeste del aula */}
        {floorplan.decor.map((item, index) => {
          if (item.type !== 'whiteboard') return null;
          const aula = floorplan.spaces.find((space) => space.code === 'salon');
          const depth = item.size?.depth ?? 2.2;
          const wallTop = floorplan.wallHeight * WALL_CUT;
          const bottom = 0.45;
          const height = Math.max(0.4, Math.min(1.2, wallTop - bottom - 0.03));
          const centerY = bottom + height / 2;
          const mountedX = (aula?.bounds.x ?? item.position.x) + floorplan.wallThickness / 2 + 0.02;
          return (
            <group key={`decor-${index}`} position={[mountedX, 0, item.position.z]}>
              <mesh position={[0, centerY, 0]} castShadow>
                <boxGeometry args={[0.04, height + 0.06, depth + 0.06]} />
                <meshStandardMaterial color="#3f4a46" roughness={0.7} />
              </mesh>
              <mesh position={[0.026, centerY, 0]} castShadow>
                <boxGeometry args={[0.02, height, depth]} />
                <meshStandardMaterial color="#fafbf8" roughness={0.35} />
              </mesh>
            </group>
          );
        })}

        {/* Tooltip 3D */}
        {hover ? (
          <Html
            position={[hover.seat.position.x, 0.95, hover.seat.position.z]}
            center
            zIndexRange={[40, 20]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="w-44 -translate-y-4 rounded-xl border border-line bg-white/97 px-3 py-2 text-left shadow-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                {hover.unitLabel} · Asiento {hover.seat.index}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-ink">
                {hover.info.status === 'libre'
                  ? 'Puesto libre'
                  : (hover.info.holder ?? 'Ocupado')}
              </p>
              {hover.info.status !== 'libre' && hover.info.companions ? (
                <p className="text-[11px] font-semibold text-gold">+ {hover.info.companions}</p>
              ) : null}
              <p className="mt-1 text-[10px] text-muted">
                {hover.info.status === 'libre'
                  ? 'Disponible en esta franja'
                  : hover.info.status === 'mio'
                    ? 'Tu reserva'
                    : 'Reservado'}
              </p>
            </div>
          </Html>
        ) : null}
      </Canvas>
    </div>
  );
}
