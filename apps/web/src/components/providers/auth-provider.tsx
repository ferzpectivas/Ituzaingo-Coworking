'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types';

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const reload = useCallback(async () => {
    try {
      const me = await api<Me>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ me: Me }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      retry: false,
    });
    setUser(result.me);
    return result.me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', retry: false });
    } catch {
      // Si la sesión ya expiró igual limpiamos el estado local.
    }
    setUser(null);
    router.push('/');
  }, [router]);

  const hasPermission = useCallback(
    (permission: string) => Boolean(user && (user.permissions.includes('*') || user.permissions.includes(permission))),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, reload, hasPermission }),
    [user, loading, login, logout, reload, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
