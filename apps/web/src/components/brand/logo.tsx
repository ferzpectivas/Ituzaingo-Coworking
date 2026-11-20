export function Logo({ size = 40, tone = 'teal' }: { size?: number; tone?: 'teal' | 'light' }) {
  const background = tone === 'teal' ? '#12595A' : '#F7F8F6';
  const foreground = tone === 'teal' ? '#F7F8F6' : '#12595A';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Espacio de Coworking de Ituzaingó">
      <rect width="48" height="48" rx="14" fill={background} />
      <path
        d="M14 31V22.5C14 17.8 18.5 14 24 14C29.5 14 34 17.8 34 22.5V31"
        fill="none"
        stroke={foreground}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M19 31V23.4C19 20.9 21.2 19 24 19C26.8 19 29 20.9 29 23.4V31" fill="none" stroke="#C9A66B" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="11" y1="34" x2="37" y2="34" stroke={foreground} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="24" cy="34" r="2.1" fill="#C9A66B" />
    </svg>
  );
}

export function Wordmark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={38} tone={tone === 'light' ? 'teal' : 'teal'} />
      <div className="leading-tight">
        <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${tone === 'light' ? 'text-white/70' : 'text-muted'}`}>
          Municipalidad de Ituzaingó
        </p>
        <p className={`font-serif text-[1.02rem] font-semibold ${tone === 'light' ? 'text-white' : 'text-ink'}`}>
          Espacio de Coworking
        </p>
      </div>
    </div>
  );
}
