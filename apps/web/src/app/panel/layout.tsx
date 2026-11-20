'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CalendarDays,
  ClipboardList,
  Gauge,
  KeyRound,
  LogOut,
  Map,
  Menu,
  MonitorCog,
  ScrollText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { useAuth } from '@/components/providers/auth-provider';
import { RoleBadge } from '@/components/ui/primitives';
import { formatDate, initials, todayISO } from '@/lib/format';
import type { Role } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Map;
  roles: Role[];
  hint?: string;
}

const NAV: NavItem[] = [
  { href: '/panel/mapa', label: 'Mapa del espacio', icon: Map, roles: ['socio', 'administrador', 'director'] },
  { href: '/panel/mis-reservas', label: 'Mis reservas', icon: CalendarDays, roles: ['socio'] },
  { href: '/panel/operaciones', label: 'Operación diaria', icon: ClipboardList, roles: ['administrador'] },
  { href: '/panel/equipos', label: 'Equipamiento', icon: MonitorCog, roles: ['administrador'] },
  { href: '/panel/director', label: 'Tablero de dirección', icon: Gauge, roles: ['director'] },
  { href: '/panel/auditoria', label: 'Auditoría', icon: ScrollText, roles: ['director'] },
  { href: '/panel/cuenta', label: 'Mi cuenta', icon: KeyRound, roles: ['socio', 'administrador', 'director'] },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/ingresar');
  }, [loading, user, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const items = useMemo(() => NAV.filter((item) => (user ? item.roles.includes(user.role) : false)), [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <Logo size={52} />
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal/25 border-t-teal" />
          <p className="text-sm text-muted">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="card max-w-sm p-6 text-center">
          <ShieldCheck className="mx-auto text-teal" />
          <h1 className="mt-3 font-serif text-xl">Sesión requerida</h1>
          <p className="mt-1 text-sm text-muted">Redirigiendo al ingreso…</p>
          <Link href="/ingresar" className="btn btn-primary btn-sm mt-4">
            Ingresar
          </Link>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  const nav = (
    <nav aria-label="Secciones del panel" className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? 'bg-teal text-white shadow-sm' : 'text-muted hover:bg-white hover:text-ink'
            }`}
          >
            <item.icon size={18} className={active ? 'text-white' : 'text-muted group-hover:text-teal'} />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Sidebar desktop */}
      <aside className="hidden border-r border-line bg-[#f2f5f0] px-4 py-5 lg:flex lg:flex-col">
        <Link href="/panel" className="focus-ring rounded-xl">
          <div className="flex items-center gap-2.5">
            <Logo size={40} />
            <div className="leading-tight">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">Ituzaingó</p>
              <p className="font-serif text-[1rem] font-semibold text-ink">Coworking</p>
            </div>
          </div>
        </Link>
        <div className="my-5 h-px bg-line" />
        {nav}
        <div className="mt-4 rounded-2xl border border-line bg-white p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-soft text-xs font-bold text-teal">
              {initials(user.person.firstName, user.person.lastName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {user.person.firstName} {user.person.lastName}
              </p>
              <p className="truncate text-[0.68rem] text-muted">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="btn btn-ghost btn-sm mt-2 w-full justify-start"
          >
            <LogOut size={15} />
            {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
        <p className="mt-3 px-1 text-[0.62rem] leading-relaxed text-muted">
          Datos alojados en el servidor municipal. Sesión segura con cookies httpOnly.
        </p>
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-full p-2 text-muted hover:bg-white lg:hidden"
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
                Espacio de Coworking · Ituzaingó
              </p>
              <p className="truncate font-serif text-lg leading-tight text-ink">
                {items.find((item) => pathname.startsWith(item.href))?.label ?? 'Panel de gestión'}
              </p>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right">
                <p className="text-[0.62rem] uppercase tracking-[0.12em] text-muted">Hoy</p>
                <p className="text-xs font-semibold text-ink">{formatDate(todayISO(), { weekday: 'long' })}</p>
              </div>
              <span className="h-8 w-px bg-line" />
              <RoleBadge role={user.role} />
              <span className="grid h-9 w-9 place-items-center rounded-full bg-teal text-xs font-bold text-white">
                {initials(user.person.firstName, user.person.lastName)}
              </span>
            </div>
          </div>
        </header>

        <main id="contenido" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <footer className="border-t border-line px-4 py-4 text-center text-[0.68rem] text-muted sm:px-6">
          Espacio de Coworking de Ituzaingó · Plataforma de reservas v1.0 · Los datos personales se
          almacenan cifrados.
        </footer>
      </div>

      {/* Drawer mobile */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#0c1a19]/45 backdrop-blur-sm"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-line bg-[#f2f5f0] px-4 py-5 shadow-2xl animate-rise">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Logo size={38} />
                <div className="leading-tight">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">Ituzaingó</p>
                  <p className="font-serif text-base font-semibold text-ink">Coworking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-full p-2 text-muted hover:bg-white"
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            </div>
            <div className="my-5 h-px bg-line" />
            {nav}
            <div className="mt-4 rounded-2xl border border-line bg-white p-3">
              <p className="truncate text-sm font-semibold text-ink">
                {user.person.firstName} {user.person.lastName}
              </p>
              <div className="mt-1">
                <RoleBadge role={user.role} />
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn btn-ghost btn-sm mt-2 w-full justify-start"
              >
                <LogOut size={15} />
                {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
