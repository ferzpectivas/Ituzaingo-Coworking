'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { SectionHeading } from '@/components/ui/primitives';

function strengthOf(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte', 'Muy fuerte'];
  return { score, label: labels[Math.min(score, 5)] };
}

export function AccountSecurity() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = strengthOf(newPassword);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== repeatPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (newPassword.length < 10) {
      setError('La nueva contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('La nueva contraseña debe incluir mayúscula, minúscula y número.');
      return;
    }
    setSubmitting(true);
    try {
      await api('/auth/password', {
        method: 'POST',
        retry: false,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      router.replace('/ingresar?password=ok');
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'No se pudo actualizar la contraseña.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Cuenta"
        title="Seguridad de la cuenta"
        description="Cambiá tu contraseña y revisá con qué identidad estás operando la plataforma."
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-soft text-teal">
              <KeyRound size={17} />
            </span>
            <div>
              <p className="font-serif text-lg text-ink">Cambiar contraseña</p>
              <p className="text-xs text-muted">
                Al confirmar se cierran las demás sesiones abiertas con tu usuario.
              </p>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="current-password">
              Contraseña actual
            </label>
            <input
              id="current-password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-password">
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                className="input"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                aria-describedby="password-help"
              />
            </div>
            <div>
              <label className="label" htmlFor="repeat-password">
                Repetir nueva contraseña
              </label>
              <input
                id="repeat-password"
                type="password"
                className="input"
                autoComplete="new-password"
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
              />
            </div>
          </div>

          {newPassword ? (
            <div id="password-help">
              <div className="flex gap-1" aria-hidden>
                {[0, 1, 2, 3, 4].map((index) => (
                  <span
                    key={index}
                    className={`h-1.5 flex-1 rounded-full ${
                      index < strength.score
                        ? strength.score >= 4
                          ? 'bg-teal'
                          : strength.score >= 3
                            ? 'bg-gold'
                            : 'bg-rose'
                        : 'bg-[#e6e9e4]'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[0.68rem] text-muted">
                Seguridad: {strength.label} · Mínimo 10 caracteres con mayúscula, minúscula y número.
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2 text-xs text-rose">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              <Lock size={14} /> {submitting ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="card p-5">
            <p className="flex items-center gap-2 font-serif text-lg text-ink">
              <ShieldCheck size={17} className="text-teal" /> Identidad activa
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Nombre</dt>
                <dd className="text-right font-medium text-ink">
                  {user ? `${user.person.firstName} ${user.person.lastName}` : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Email</dt>
                <dd className="truncate text-right font-medium text-ink">{user?.email ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Documento</dt>
                <dd className="text-right font-medium text-ink">****{user?.person.docLast4 ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Rol</dt>
                <dd className="text-right font-medium capitalize text-ink">{user?.role ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-white p-4">
            <p className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-muted">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-teal" />
              Las contraseñas se guardan con derivación scrypt y sal aleatoria; nunca se almacenan en
              texto plano. Si olvidaste tu contraseña, el administrador del sistema debe restablecerla
              desde el servidor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
