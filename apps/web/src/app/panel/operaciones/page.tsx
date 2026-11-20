import type { Metadata } from 'next';
import floorplanJson from '@/lib/floorplan.generated.json';
import type { Floorplan } from '@/lib/types';
import { OperationsWorkspace } from '@/components/admin/operations-workspace';

export const metadata: Metadata = {
  title: 'Operación diaria',
};

export default function OperacionesPage() {
  const floorplan = floorplanJson as unknown as Floorplan;
  return <OperationsWorkspace floorplan={floorplan} />;
}
