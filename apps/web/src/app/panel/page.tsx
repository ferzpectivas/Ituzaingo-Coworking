'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { PageLoader } from '@/components/ui/primitives';

const HOME_BY_ROLE = {
  socio: '/panel/mapa',
  administrador: '/panel/operaciones',
  director: '/panel/director',
} as const;

export default function PanelIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace(HOME_BY_ROLE[user.role]);
  }, [loading, user, router]);

  return <PageLoader label="Preparando tu panel" />;
}
