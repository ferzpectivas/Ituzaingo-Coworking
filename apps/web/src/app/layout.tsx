import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './globals.css';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ToastProvider } from '@/components/providers/toast-provider';

export const metadata: Metadata = {
  title: {
    default: 'Espacio de Coworking · Ituzaingó',
    template: '%s · Coworking Ituzaingó',
  },
  description:
    'Reservá tu puesto en el Espacio de Coworking de Ituzaingó: mapa interactivo, salón de capacitaciones y sala de reuniones.',
  applicationName: 'Coworking Ituzaingó',
  authors: [{ name: 'Municipalidad de Ituzaingó' }],
  keywords: ['coworking', 'Ituzaingó', 'reservas', 'espacio de trabajo', 'municipalidad'],
  openGraph: {
    title: 'Espacio de Coworking de Ituzaingó',
    description: 'Un espacio público para trabajar, aprender y encontrarse.',
    locale: 'es_AR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#12595A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-teal focus:px-5 focus:py-3 focus:text-white"
        >
          Saltar al contenido
        </a>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
