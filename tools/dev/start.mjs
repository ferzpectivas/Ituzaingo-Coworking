#!/usr/bin/env node
// Arranque del monorepo para probar el build de producción.
//
// En local `npm start` levanta API y web juntos. En Render, en cambio, cada
// servicio debe correr un solo proceso: la plataforma inyecta el mismo `PORT`
// en todos y dos listeners sobre ese puerto fallan con EADDRINUSE. Por eso,
// cuando `RENDER=true`, este script arranca únicamente el proceso que
// corresponde al servicio.
//
// El rol se toma de `SERVICE_ROLE` (lo define render.yaml). Si falta, se
// infiere del nombre del servicio: los que terminan en `-api` arrancan la API
// y el resto la web. Para forzar un rol en local usá `npm run start:api` o
// `npm run start:web`.

import { spawn } from 'node:child_process';

const isRender = process.env.RENDER === 'true';
const explicitRole = (process.env.SERVICE_ROLE ?? '').trim().toLowerCase();
const serviceName = process.env.RENDER_SERVICE_NAME ?? '';

function resolveScript() {
  if (!isRender) return 'start:all';
  if (explicitRole === 'api' || explicitRole === 'web') {
    return `start:${explicitRole}`;
  }
  if (serviceName.endsWith('-api')) return 'start:api';
  return 'start:web';
}

const script = resolveScript();

if (isRender) {
  const target = script === 'start:api' ? 'API' : 'web';
  const name = serviceName || 'servicio sin nombre';
  console.log(`[start] Render detectado (${name}): arrancando sólo la ${target}.`);
}

const child = spawn('npm', ['run', script], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
