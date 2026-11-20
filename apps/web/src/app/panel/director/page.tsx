import type { Metadata } from 'next';
import { DirectorDashboard } from '@/components/director/director-dashboard';

export const metadata: Metadata = {
  title: 'Tablero de dirección',
};

export default function DirectorPage() {
  return <DirectorDashboard />;
}
