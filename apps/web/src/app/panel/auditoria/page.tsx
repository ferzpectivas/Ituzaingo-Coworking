import type { Metadata } from 'next';
import { AuditWorkspace } from '@/components/director/audit-workspace';

export const metadata: Metadata = {
  title: 'Auditoría',
};

export default function AuditoriaPage() {
  return <AuditWorkspace />;
}
