'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Box, Map as MapIcon } from 'lucide-react';
import { Floorplan2D } from './floorplan-2d';
import type { Floorplan, Occupancy } from '@/lib/types';

const Map3D = dynamic(() => import('./map-3d').then((mod) => mod.Map3D), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center bg-[#f2f5f0]">
      <p className="text-sm text-muted">Cargando mapa 3D…</p>
    </div>
  ),
});

export function MapView({
  floorplan,
  occupancy,
  selectedSpace,
  onSelectSpace,
  height = 'h-[520px]',
  showSeats = true,
}: {
  floorplan: Floorplan;
  occupancy?: Occupancy | null;
  selectedSpace?: string | null;
  onSelectSpace?: (code: string) => void;
  height?: string;
  showSeats?: boolean;
}) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="inline-flex rounded-full border border-line bg-[#f7f8f6] p-0.5" role="group" aria-label="Vista del plano">
          <button
            type="button"
            onClick={() => setMode('3d')}
            aria-pressed={mode === '3d'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              mode === '3d' ? 'bg-teal text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <Box size={14} /> 3D
          </button>
          <button
            type="button"
            onClick={() => setMode('2d')}
            aria-pressed={mode === '2d'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              mode === '2d' ? 'bg-teal text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <MapIcon size={14} /> Planta
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#8fbfb2]" /> Libre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#c56a6a]" /> Ocupado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#c9a66b]" /> Tu reserva
          </span>
        </div>
      </div>

      <div className={`relative ${height}`}>
        {mode === '3d' ? (
          <Map3D
            floorplan={floorplan}
            occupancy={occupancy ?? null}
            selectedSpace={selectedSpace}
            onSelectSpace={onSelectSpace}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#f7f8f6] p-3">
            <Floorplan2D
              floorplan={floorplan}
              occupancy={occupancy ?? null}
              selectedSpace={selectedSpace}
              onSelectSpace={onSelectSpace}
              showSeats={showSeats}
              className="h-full w-full"
            />
          </div>
        )}
        {mode === '3d' ? (
          <p className="pointer-events-none absolute bottom-2 left-3 rounded-full bg-white/80 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
            Arrastrá para rotar · Scroll para acercar · Tocá un asiento para ver la reserva
          </p>
        ) : null}
      </div>
    </div>
  );
}
