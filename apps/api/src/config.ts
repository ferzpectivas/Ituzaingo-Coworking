import fs from 'node:fs';
import path from 'node:path';

function findProjectRoot(start: string): string {
  let current = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(current, 'mapa.drawio.svg'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(start, '../..');
}

const root = findProjectRoot(process.cwd());

// Carga mínima de .env sin dependencias: sólo completa variables ausentes.
try {
  const envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)) {
    for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const index = line.indexOf('=');
      if (index < 0) continue;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
} catch {
  // La configuración por entorno sigue siendo válida sin .env.
}

export const appConfig = {
  root,
  port: Number(process.env.API_PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  jwtSecret:
    process.env.JWT_SECRET ?? 'ituzaingo-coworking-dev-secret-change-in-production-2026',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.cwd(), process.env.DATA_DIR)
    : path.join(root, 'data'),
  seedOnStart: process.env.SEED_ON_START !== 'false',
  timezone: 'America/Argentina/Buenos_Aires',
  personalDataKey: process.env.PERSONAL_DATA_KEY ?? process.env.JWT_SECRET ?? 'dev-personal-key',
  isProduction: process.env.NODE_ENV === 'production',
};

export const COOKIE_ACCESS = 'cw_access';
export const COOKIE_REFRESH = 'cw_refresh';
