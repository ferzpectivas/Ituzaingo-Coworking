'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { ROLE_LABELS, STATUS_LABELS, STATUS_STYLES } from '@/lib/format';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? 'bg-[#eef1ee] text-muted'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    socio: 'bg-blue-soft text-blue',
    administrador: 'bg-teal-soft text-teal',
    director: 'bg-gold-soft text-amber',
  };
  return <span className={`badge ${styles[role] ?? 'bg-[#eef1ee] text-muted'}`}>{ROLE_LABELS[role] ?? role}</span>;
}

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-teal/25 border-t-teal"
        aria-hidden
      />
      {label}
    </span>
  );
}

export function PageLoader({ label = 'Cargando información' }: { label?: string }) {
  return (
    <div className="flex min-h-[38vh] flex-col items-center justify-center gap-3 text-muted">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-teal/20 border-t-teal" aria-hidden />
      <p className="text-sm">{label}…</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-teal/70">{icon}</div> : null}
      <h3 className="font-serif text-lg text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="font-serif text-2xl leading-tight text-ink sm:text-3xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'teal' | 'gold' | 'rose';
}) {
  const tones = {
    default: 'text-ink',
    teal: 'text-teal',
    gold: 'text-amber',
    rose: 'text-rose',
  };
  return (
    <div className="card px-4 py-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-1 font-serif text-2xl leading-none ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'teal',
  label,
}: {
  value: number;
  tone?: 'teal' | 'gold' | 'blue';
  label?: string;
}) {
  const colors = { teal: 'bg-teal', gold: 'bg-gold', blue: 'bg-blue' };
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>{label}</span>
          <span className="font-semibold text-ink">{(clamped * 100).toFixed(0)}%</span>
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[#edf0ec]"
        role="progressbar"
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={`h-full rounded-full transition-all duration-500 ${colors[tone]}`} style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}

export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<{ value: string; label: string; count?: number }>;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-white p-1">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active ? 'bg-teal text-white shadow-sm' : 'text-muted hover:bg-[#f0f3ef] hover:text-ink'
            }`}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className={`ml-1.5 text-xs ${active ? 'text-white/75' : 'text-muted'}`}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Mantiene la referencia al último onClose sin re-ejecutar el efecto de apertura.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const active = document.activeElement;
      // No robar el foco si la persona ya empezó a interactuar con el diálogo.
      if (active instanceof HTMLElement && panel.contains(active)) return;
      panel.focus();
    }, 30);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0c1a19]/45 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[92vh] w-full ${widths[size]} flex-col overflow-hidden rounded-t-3xl border border-line bg-white shadow-2xl outline-none sm:rounded-3xl animate-rise`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h3 id={titleId} className="font-serif text-xl text-ink">
              {title}
            </h3>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted transition hover:bg-[#eef1ee] hover:text-ink"
            aria-label="Cerrar diálogo"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line bg-[#fbfcfa] px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
