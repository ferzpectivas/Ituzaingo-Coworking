import type { Metadata } from 'next';
import { EquipmentWorkspace } from '@/components/admin/equipment-workspace';

export const metadata: Metadata = {
  title: 'Equipamiento',
};

export default function EquiposPage() {
  return <EquipmentWorkspace />;
}
