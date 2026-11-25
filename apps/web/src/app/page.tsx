import Link from 'next/link';
import {
  Accessibility,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Laptop,
  MapPinned,
  MonitorPlay,
  Presentation,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
} from 'lucide-react';
import { Wordmark } from '@/components/brand/logo';
import { Floorplan2D } from '@/components/map/floorplan-2d';
import floorplanJson from '@/lib/floorplan.generated.json';
import type { Floorplan } from '@/lib/types';

const floorplan = floorplanJson as unknown as Floorplan;
const spaces = floorplan.spaces.filter((space) => space.bookable);

const SPACE_FEATURES: Record<string, string[]> = {
  coworking: ['20 puestos en mesas colaborativas', 'Trabajo individual o en equipo', 'Enchufes y conectividad'],
  salon: ['15 pupitres individuales', 'Capacitaciones y talleres', 'Pizarra y proyector'],
  'sala-reuniones': ['Mesa ejecutiva para 10', 'Reuniones cerradas', 'Proyector y videollamada'],
};

const steps = [
  {
    icon: CalendarCheck2,
    title: 'Elegí espacio, día y franja',
    text: 'Consultá la disponibilidad real del plano y seleccioná el ambiente, la fecha y la franja horaria.',
  },
  {
    icon: Users,
    title: 'Sumá a las personas',
    text: 'Ingresá el titular y cada acompañante con nombre, apellido y DNI. Todos quedan registrados.',
  },
  {
    icon: Laptop,
    title: 'Pedí equipamiento',
    text: 'Notebook con funda y cargador, proyector con caja, HDMI, VGA y cable de energía, o pizarra desplazable.',
  },
];

const faqs = [
  {
    q: '¿Quién puede reservar el espacio?',
    a: 'Las personas mayores de edad con DNI que se registren como socias del Espacio de Coworking. Cada reserva incluye un titular y sus acompañantes identificados.',
  },
  {
    q: '¿Cuántas personas puedo traer?',
    a: 'Depende del ambiente: el Coworking 1 tiene 20 puestos, el Aula de Capacitaciones 15 pupitres individuales y la Sala de Reuniones se reserva completa para 10 personas.',
  },
  {
    q: '¿Cuál es el horario del espacio?',
    a: 'El espacio abre de lunes a viernes de 08:00 a 18:00. Hay tres franjas: 08:00 a 11:00, 11:00 a 15:00 y 15:00 a 18:00. Podés reservar hasta 45 días de anticipación.',
  },
  {
    q: '¿Puedo cancelar mi reserva?',
    a: 'Podés cancelar desde Mis reservas hasta 2 horas antes del inicio de la franja. Si el equipamiento ya fue entregado, primero debe registrarse la devolución.',
  },
  {
    q: '¿El equipamiento tiene costo?',
    a: 'No. El servicio es gratuito. Al retirar la notebook se revisan la funda y el cargador; en el proyector, la caja, los cables HDMI, VGA y de energía. La pizarra desplazable se entrega sin accesorios.',
  },
];

export default function HomePage() {
  const totalSeats = spaces.reduce((acc, space) => acc + (space.capacity ?? 0), 0);

  return (
    <div id="contenido" className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
        <div className="container-page flex h-18 items-center justify-between gap-4 py-3">
          <Link href="/" aria-label="Inicio" className="focus-ring rounded-xl">
            <Wordmark />
          </Link>
          <nav aria-label="Navegación principal" className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <a href="#espacio" className="transition hover:text-teal">
              El espacio
            </a>
            <a href="#reservar" className="transition hover:text-teal">
              Cómo reservar
            </a>
            <a href="#equipamiento" className="transition hover:text-teal">
              Equipamiento
            </a>
            <a href="#preguntas" className="transition hover:text-teal">
              Preguntas
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/ingresar" className="btn btn-primary btn-sm">
              Ingresar
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(1200px 420px at 15% -10%, rgba(18,89,90,0.14), transparent 65%), radial-gradient(900px 380px at 95% 10%, rgba(201,166,107,0.20), transparent 60%)',
            }}
          />
          <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div className="animate-rise">
              <p className="eyebrow">Municipalidad de Ituzaingó</p>
              <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-[1.06] text-ink sm:text-5xl lg:text-[3.4rem]">
                Un espacio público para{' '}
                <span className="relative whitespace-nowrap text-teal">
                  trabajar
                  <svg
                    className="absolute -bottom-1 left-0 h-2 w-full text-gold"
                    viewBox="0 0 200 8"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path d="M1 5.5C40 1.5 120 1.5 199 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </span>
                , aprender y encontrarse.
              </h1>
              <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-muted">
                Reservá tu puesto en el Espacio de Coworking de Ituzaingó. Elegí entre mesas colaborativas,
                pupitres para capacitaciones y una sala de reuniones equipada. Todo en un mismo lugar,
                sin costo y con atención municipal.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/ingresar" className="btn btn-primary">
                  Reservar mi puesto
                  <ArrowRight size={17} />
                </Link>
                <a href="#espacio" className="btn btn-outline">
                  Conocer el espacio
                </a>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
                {[
                  { value: totalSeats, label: 'puestos disponibles' },
                  { value: spaces.length, label: 'ambientes reservables' },
                  { value: 3, label: 'franjas por día' },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="font-serif text-3xl text-teal">{item.value}</dt>
                    <dd className="mt-0.5 text-xs leading-snug text-muted">{item.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative animate-rise">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">Plano interactivo</p>
                    <p className="font-serif text-lg text-ink">Planta del espacio</p>
                  </div>
                  <span className="badge bg-teal-soft text-teal">
                    <Sparkles size={12} /> 3 ambientes
                  </span>
                </div>
                <div className="bg-[#f7f8f6] p-2 sm:p-3">
                  <Floorplan2D
                    floorplan={floorplan}
                    showSeats
                    className="h-auto w-full rounded-xl"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#8fbfb2]" /> Puesto libre
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#b4484a]" /> Pupitre
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#a9744f]" /> Mesa grupal
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-line bg-white px-4 py-3 shadow-lg sm:block">
                <p className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <Clock3 size={14} className="text-teal" />
                  Lunes a viernes · 08 a 18
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Franjas */}
        <section aria-label="Franjas horarias" className="border-y border-line bg-white">
          <div className="container-page grid gap-4 py-6 sm:grid-cols-3">
            {[
              { icon: Clock3, title: 'Tres franjas diarias', text: 'De 08:00 a 11:00, de 11:00 a 15:00 y de 15:00 a 18:00, de lunes a viernes.' },
              { icon: MapPinned, title: 'Tres ambientes', text: 'Coworking, Aula de capacitaciones y Sala de Reuniones.' },
              { icon: Accessibility, title: 'Accesible y gratuito', text: 'Planta baja, circulación amplia y atención municipal.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-soft text-teal">
                  <item.icon size={17} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs leading-relaxed text-muted">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Espacios */}
        <section id="espacio" className="container-page scroll-mt-24 py-16">
          <div className="max-w-2xl">
            <p className="eyebrow">El espacio</p>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
              Tres formas de usar el mismo lugar
            </h2>
            <p className="mt-3 text-[0.98rem] leading-relaxed text-muted">
              El plano respeta la distribución real del edificio: cada ambiente tiene su mobiliario,
              su capacidad y su forma de reserva. Los puestos se asignan automáticamente según la
              cantidad de personas y la disponibilidad de la franja.
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {spaces.map((space) => (
              <article
                key={space.code}
                className="card group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1"
                style={{ borderTopColor: space.color, borderTopWidth: 4 }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl font-serif text-lg font-semibold"
                    style={{ background: space.accent, color: space.color }}
                  >
                    {space.number}
                  </span>
                  <span className="badge bg-[#f1f4f0] text-muted">{space.capacity} personas</span>
                </div>
                <h3 className="mt-4 font-serif text-xl text-ink">{space.name}</h3>
                <p className="mt-1.5 min-h-16 text-sm leading-relaxed text-muted">{space.description}</p>
                <ul className="mt-3 space-y-1.5">
                  {(SPACE_FEATURES[space.code] ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[0.82rem] text-ink/80">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-teal" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                  {space.furnitureCount} muebles · {space.capacity} puestos
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Cómo reservar */}
        <section id="reservar" className="scroll-mt-24 border-y border-line bg-white">
          <div className="container-page py-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <p className="eyebrow">Cómo reservar</p>
                <h2 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
                  Tres pasos, una reserva clara
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  El asistente te guía en orden: primero el espacio y la franja, después las personas
                  con DNI y por último el equipamiento opcional. Nada se confirma hasta el final.
                </p>
              </div>
              <Link href="/ingresar" className="btn btn-gold self-start">
                Empezar ahora
                <ArrowRight size={16} />
              </Link>
            </div>
            <ol className="mt-9 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="card-flat relative p-5">
                  <span className="absolute right-4 top-4 font-serif text-4xl text-line">{index + 1}</span>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gold-soft text-amber">
                    <step.icon size={20} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Equipamiento */}
        <section id="equipamiento" className="container-page scroll-mt-24 py-16">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow">Equipamiento</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
                Lo que necesitás, controlado
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Cada equipo se entrega con un checklist y se recibe con otro. Si falta un accesorio,
                queda registrado como incidente y el equipo pasa a mantenimiento hasta resolverse.
              </p>
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3 rounded-xl bg-teal-soft/70 p-3.5">
                  <ShieldCheck size={18} className="mt-0.5 text-teal" />
                  <p className="text-sm leading-relaxed text-ink/80">
                    El inventario es público dentro del sistema: sabés qué hay disponible antes de reservar.
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-gold-soft/70 p-3.5">
                  <Wifi size={18} className="mt-0.5 text-amber" />
                  <p className="text-sm leading-relaxed text-ink/80">
                    Conectividad, enchufes y proyector en los tres ambientes. Traé tu propia notebook si preferís.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <article className="card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-soft text-teal">
                  <Laptop size={21} />
                </span>
                <h3 className="mt-4 font-serif text-xl text-ink">Notebooks</h3>
                <p className="mt-1 text-sm text-muted">2 equipos disponibles para usar en el espacio.</p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-teal" /> Funda protectora
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-teal" /> Cargador original
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-teal" /> Checklist de entrega y devolución
                  </li>
                </ul>
              </article>
              <article className="card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-soft text-blue">
                  <MonitorPlay size={21} />
                </span>
                <h3 className="mt-4 font-serif text-xl text-ink">Proyector</h3>
                <p className="mt-1 text-sm text-muted">1 equipo, ideal para el Aula y la Sala de Reuniones.</p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue" /> Caja de transporte
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue" /> Cables HDMI y VGA
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue" /> Cable de energía
                  </li>
                </ul>
              </article>
              <article className="card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-soft text-amber">
                  <Presentation size={21} />
                </span>
                <h3 className="mt-4 font-serif text-xl text-ink">Pizarra desplazable</h3>
                <p className="mt-1 text-sm text-muted">1 pizarra para el Aula de Capacitaciones.</p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-amber" /> Se traslada a cualquier ambiente
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-amber" /> Sin accesorios obligatorios
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-amber" /> Checklist de entrega y devolución
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* Políticas */}
        <section className="border-y border-line bg-white">
          <div className="container-page grid gap-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: '45 días de anticipación', text: 'Podés reservar con hasta 45 días de anticipación.' },
              { title: 'Cancelación con 2 horas', text: 'Avisá con dos horas para liberar el puesto.' },
              { title: 'Check-in municipal', text: 'El personal administrativo registra ingresos y egresos.' },
              { title: 'Datos protegidos', text: 'El DNI se guarda cifrado; sólo se muestran los últimos 4 dígitos.' },
            ].map((item) => (
              <div key={item.title}>
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <CheckCircle2 size={15} className="text-teal" />
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="preguntas" className="container-page scroll-mt-24 py-16">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">Preguntas frecuentes</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
                Antes de reservar
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Si te queda una duda, escribinos a la Secretaría de Desarrollo Productivo de la
                Municipalidad de Ituzaingó.
              </p>
              <div className="mt-6 rounded-2xl border border-line bg-white p-5">
                <p className="text-sm font-semibold text-ink">¿Listo para empezar?</p>
                <p className="mt-1 text-xs text-muted">Ingresá con tu cuenta y elegí tu franja.</p>
                <Link href="/ingresar" className="btn btn-primary btn-sm mt-3">
                  Reservar
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {faqs.map((faq) => (
                <details key={faq.q} className="group px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-semibold text-ink marker:hidden">
                    {faq.q}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f1f4f0] text-muted transition group-open:rotate-45 group-open:bg-teal group-open:text-white">
                      +
                    </span>
                  </summary>
                  <p className="pb-4 pr-8 text-sm leading-relaxed text-muted">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-teal-dark text-white">
        <div className="container-page grid gap-8 py-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Wordmark tone="light" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              Un espacio público de la Municipalidad de Ituzaingó para trabajar, capacitarse y
              encontrarse. Reservas gratuitas con identificación de todas las personas.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">El espacio</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              {spaces.map((space) => (
                <li key={space.code}>
                  {space.name} · {space.capacity} puestos
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Acceso</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li>Ituzaingó, Buenos Aires</li>
              <li>Lunes a viernes</li>
              <li>08:00 a 18:00</li>
              <li>
                <Link href="/ingresar" className="underline decoration-gold/60 underline-offset-4 hover:text-gold">
                  Ingresar al sistema
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-page flex flex-col gap-2 py-4 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Municipalidad de Ituzaingó. Espacio de Coworking.</p>
            <p>Plataforma de gestión de reservas · Datos alojados en servidores municipales.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
