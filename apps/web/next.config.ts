import type { NextConfig } from 'next';

// En Render (u otro PaaS) no hay Caddy/nginx delante que enrute /api/* a la
// API. API_ORIGIN, definida en ese entorno, publica la API bajo el mismo
// origen de la web mediante un rewrite. Sin la variable no se agrega ningún
// rewrite: en local (npm run dev, Caddy o nginx) el enrutamiento lo hace el
// proxy de siempre. Next 16 hornea los rewrites en routes-manifest.json al
// compilar: la variable tiene que estar presente en el build (en Render las
// variables de entorno lo están) y cambiarla exige un redeploy.
const apiOrigin = process.env.API_ORIGIN?.trim().replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(apiOrigin
    ? {
        rewrites: async () => [
          { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
        ],
      }
    : {}),
};

export default nextConfig;
