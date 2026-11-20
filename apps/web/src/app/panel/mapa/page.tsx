import type { Metadata } from 'next';
import floorplanJson from '@/lib/floorplan.generated.json';
import type { Floorplan } from '@/lib/types';
import { MapWorkspace } from '@/components/map/map-workspace';

export const metadata: Metadata = {
  title: 'Mapa del espacio',
};

export default function MapPage() {
  const floorplan = floorplanJson as unknown as Floorplan;
  return <MapWorkspace floorplan={floorplan} />;
}
