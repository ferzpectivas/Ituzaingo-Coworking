'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Wordmark } from '@/components/brand/logo';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api';
import type { Role } from '@/lib/types';

const DEMO: Array<{ role: Role; label: string; email: string; password: string }> = [
  { role: 'socio', label: 'Socio', email: 'socio@coworking.gob.ar', password: 'Socio1234!' },
  { role: 'administrador', label: 'Administrador', email: 'admin@coworking.gob.ar', password: 'Admin1234!' },
  { role: 'director', label: 'Director', email: 'director@coworking.gob.ar', password: 'Director1234!' },
];

const HOME_BY_ROLE: Record<Role, string> = {
  socio: '/panel/mapa',
  administrador: '/panel/operaciones',
  director: '/panel/director',
};

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('password') === 'ok') {
      setNotice('Contraseña actualizada. Iniciá sesión con tu nueva clave.');
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace(HOME_BY_ROLE[user.role]);
    }
  }, [loading, user, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login(email, password);
      router.replace(HOME_BY_ROLE[me.role]);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'No pudimos iniciar sesión. Verificá la conexión con el servidor.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fill(demo: (typeof DEMO)[number]) {
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-teal p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(600px 300px at 80% 0%, rgba(201,166,107,0.55), transparent 70%), radial-gradient(500px 400px at 0% 100%, rgba(255,255,255,0.18), transparent 70%)',
          }}
        />
        <div className="relative">
          <Wordmark tone="light" />
        </div>
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Acceso al sistema</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight">
            Tu puesto, tus reservas y el mapa del espacio en un solo lugar.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            Socios y socias gestionan sus reservas. El equipo administrativo opera el día a día y la
            dirección accede a indicadores y auditoría sin intervenir en la operación.
          </p>
          <ul className="mt-7 space-y-3 text-sm text-white/85">
            {[
              'Mapa 3D interactivo con ocupación en vivo',
              'Reservas con titular y acompañantes identificados',
              'Checklist de equipamiento en cada entrega',
              'Reportes PDF, Excel y CSV para gestión',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-gold" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">
          Municipalidad de Ituzaingó · Espacio de Coworking
        </p>
      </aside>

      <main className="flex min-h-screen flex-col bg-paper">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-teal">
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
          <div className="lg:hidden">
            <Wordmark />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-soft text-teal">
                <LockKeyhole size={20} />
              </span>
              <div>
                <h2 className="font-serif text-2xl text-ink">Ingresar</h2>
                <p className="text-sm text-muted">Usá tu cuenta institucional o de socio.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="card space-y-4 p-5 sm:p-6" noValidate>
              {notice ? (
                <p role="status" className="rounded-xl border border-teal/25 bg-teal-soft px-3.5 py-2.5 text-sm text-teal">
                  {notice}
                </p>
              ) : null}
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input"
                  placeholder="nombre@coworking.gob.ar"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(error)}
                />
              </div>
              <div>
                <label htmlFor="password" className="label">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    minLength={6}
                    className="input pr-11"
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={Boolean(error)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted hover:bg-[#eef1ee]"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error ? (
                <p role="alert" className="rounded-xl border border-rose/25 bg-rose-soft px-3.5 py-2.5 text-sm text-rose">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                {submitting ? 'Ingresando…' : 'Ingresar'}
                {!submitting ? <ArrowRight size={17} /> : null}
              </button>

              <p className="text-center text-xs text-muted">
                Al ingresar aceptás las políticas de uso del espacio y el tratamiento de tus datos
                personales.
              </p>
            </form>

            <div className="mt-5 rounded-2xl border border-dashed border-line bg-white/70 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Acceso de demostración
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {DEMO.map((demo) => (
                  <button
                    key={demo.role}
                    type="button"
                    onClick={() => fill(demo)}
                    className="rounded-xl border border-line bg-white px-3 py-2 text-left text-xs transition hover:border-teal/40 hover:bg-teal-soft/40"
                  >
                    <span className="block font-semibold text-ink">{demo.label}</span>
                    <span className="block truncate text-[0.68rem] text-muted">{demo.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
