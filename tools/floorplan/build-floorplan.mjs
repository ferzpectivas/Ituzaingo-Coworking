#!/usr/bin/env node
/**
 * Pipeline `mapa del lugar.svg` -> manifiesto arquitectónico JSON.
 *
 * El SVG es un export de draw.io. No se usa SVGLoader en runtime: se parsea la
 * geometría vectorial una sola vez, se normaliza a metros y se enriquece con
 * asientos y aberturas. El resultado es determinista y compartido por la vista
 * 3D, la vista 2D y la API.
 *
 * Uso: npm run floorplan
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SVG_PATH = path.join(ROOT, 'mapa del lugar.svg');
const TARGETS = [
  path.join(ROOT, 'apps/api/src/floorplan/floorplan.generated.json'),
  path.join(ROOT, 'apps/web/src/lib/floorplan.generated.json'),
];

const SCALE = 0.025; // 1 unidad del SVG = 2,5 cm
const ORIGIN = { x: 19.2, y: 0.6 };
const WALL_HEIGHT = 2.6;
const WALL_THICKNESS = 0.12;
const CHAIR_GAP = 0.3;

const round = (v, p = 4) => Number(Number(v).toFixed(p));
const nx = (v) => round((v - ORIGIN.x) * SCALE);
const nz = (v) => round((v - ORIGIN.y) * SCALE);

function attrs(source) {
  const out = {};
  for (const m of source.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

function parseNumber(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function rotatedSize(w, h, angle) {
  const a = ((angle % 360) + 360) % 360;
  const swapped = Math.abs(a - 90) < 0.01 || Math.abs(a - 270) < 0.01;
  return swapped ? { width: h, depth: w } : { width: w, depth: h };
}

function dedupeSegments(segments) {
  const seen = new Set();
  const out = [];
  for (const s of segments) {
    const a = `${s.x1.toFixed(3)},${s.z1.toFixed(3)}`;
    const b = `${s.x2.toFixed(3)},${s.z2.toFixed(3)}`;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    if (Math.abs(s.x1 - s.x2) < 0.001 && Math.abs(s.z1 - s.z2) < 0.001) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function wallBox(axis, line, from, to, y, height, kind = 'wall') {
  const length = round(to - from);
  if (length <= 0.001) return null;
  if (axis === 'h') {
    return {
      x: round(from + length / 2),
      z: round(line),
      width: length,
      depth: WALL_THICKNESS,
      y: round(y),
      height: round(height),
      kind,
    };
  }
  return {
    x: round(line),
    z: round(from + length / 2),
    width: WALL_THICKNESS,
    depth: length,
    y: round(y),
    height: round(height),
    kind,
  };
}

// ---------------------------------------------------------------------------
// 1. Lectura y parseo del SVG
// ---------------------------------------------------------------------------
const svg = fs.readFileSync(SVG_PATH, 'utf8');

const pathMatch = [...svg.matchAll(/<path\b([^>]*?)d="([^"]+)"([^>]*)>/g)].find((m) =>
  /fill="none"/.test(m[1] + m[3]),
);
if (!pathMatch) throw new Error('No se encontró la polilínea de muros en el SVG.');
const pathD = pathMatch[2];
const pathPoints = [];
for (const m of pathD.matchAll(/[ML]\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)/g)) {
  pathPoints.push({ x: parseNumber(m[1]), y: parseNumber(m[2]) });
}

const textLabels = [];
for (const m of svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/g)) {
  const a = attrs(m[1]);
  const value = m[2]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  if (!value || value.startsWith('Text is not SVG')) continue;
  textLabels.push({
    text: value,
    x: parseNumber(a.x),
    y: parseNumber(a.y),
    size: parseNumber(a['font-size'], 12),
  });
}

const rects = [];
for (const m of svg.matchAll(/<rect\b([^>]*?)\/?>/g)) {
  const a = attrs(m[1]);
  if (a.width === undefined || a.height === undefined) continue;
  const w = parseNumber(a.width);
  const h = parseNumber(a.height);
  if (w < 8 || h < 8) continue;
  const fill = (a.fill || '').toLowerCase();
  let cx = parseNumber(a.x) + w / 2;
  let cy = parseNumber(a.y) + h / 2;
  let angle = 0;
  if (a.transform) {
    const t = /rotate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(a.transform);
    if (t) {
      angle = parseNumber(t[1]);
      cx = parseNumber(t[2]);
      cy = parseNumber(t[3]);
    }
  }
  rects.push({
    x: parseNumber(a.x),
    y: parseNumber(a.y),
    w,
    h,
    cx,
    cy,
    angle,
    fill,
    rx: parseNumber(a.rx),
  });
}

const roomRects = rects.filter(
  (r) => r.fill === 'none' && r.w >= 100 && r.h >= 100 && r.rx === 0,
);
const tableRects = rects.filter((r) => r.fill === '#ffcc99');
const deskRects = rects.filter((r) => r.fill === '#e51400');

if (roomRects.length !== 2) {
  throw new Error(`Se esperaban 2 rectángulos de ambiente, se encontraron ${roomRects.length}.`);
}
if (tableRects.length !== 4) {
  throw new Error(`Se esperaban 4 mesas marrones, se encontraron ${tableRects.length}.`);
}
if (deskRects.length !== 10) {
  throw new Error(`Se esperaban 10 pupitres rojos, se encontraron ${deskRects.length}.`);
}

const salonRect = roomRects.find((r) => r.w === 170 && r.h === 160) ?? roomRects[0];
const salaRect = roomRects.find((r) => r !== salonRect) ?? roomRects[1];

const pathXs = pathPoints.map((p) => p.x);
const pathYs = pathPoints.map((p) => p.y);
const coworkingBoundsSvg = {
  x: Math.min(...pathXs),
  y: Math.min(...pathYs),
  w: Math.max(...pathXs) - Math.min(...pathXs),
  h: Math.max(...pathYs) - Math.min(...pathYs),
};

const spaceDefs = [
  {
    code: 'coworking',
    name: 'Coworking',
    description: 'Mesas colaborativas para trabajo individual o en equipo.',
    color: '#12595A',
    accent: '#E6F2F0',
    boundsSvg: coworkingBoundsSvg,
    bookable: true,
  },
  {
    code: 'salon',
    name: 'Salón',
    description: 'Pupitres individuales para capacitaciones y jornadas de trabajo.',
    color: '#C9A66B',
    accent: '#F6EFE3',
    boundsSvg: { x: salonRect.x, y: salonRect.y, w: salonRect.w, h: salonRect.h },
    bookable: true,
  },
  {
    code: 'sala-reuniones',
    name: 'Sala de Reuniones',
    description: 'Mesa ejecutiva para reuniones cerradas y presentaciones.',
    color: '#2B6CB0',
    accent: '#E8F0FA',
    boundsSvg: { x: salaRect.x, y: salaRect.y, w: salaRect.w, h: salaRect.h },
    bookable: true,
  },
  {
    code: 'acceso',
    name: 'Acceso',
    description: 'Patio de ingreso y circulación. No es un espacio reservable.',
    color: '#8A9A96',
    accent: '#EEF1EE',
    boundsSvg: {
      x: coworkingBoundsSvg.x,
      y: salonRect.y,
      w: salonRect.x - coworkingBoundsSvg.x,
      h: salonRect.h,
    },
    bookable: false,
  },
];

const spaces = spaceDefs.map((s) => {
  const x = nx(s.boundsSvg.x);
  const z = nz(s.boundsSvg.y);
  const width = round(s.boundsSvg.w * SCALE);
  const depth = round(s.boundsSvg.h * SCALE);
  return {
    code: s.code,
    name: s.name,
    description: s.description,
    color: s.color,
    accent: s.accent,
    bookable: s.bookable,
    bounds: { x, z, width, depth },
    centroid: { x: round(x + width / 2), z: round(z + depth / 2) },
    labelPosition: {
      x: round(x + Math.min(0.45, width / 4)),
      z: round(z + Math.min(0.45, depth / 4)),
    },
    number:
      s.code === 'coworking' ? 1 : s.code === 'salon' ? 2 : s.code === 'sala-reuniones' ? 3 : 0,
  };
});

// ---------------------------------------------------------------------------
// 2. Muros: polilínea + bordes de los rectángulos, deduplicados
// ---------------------------------------------------------------------------
const rawWalls = [];
for (let i = 1; i < pathPoints.length; i += 1) {
  const a = pathPoints[i - 1];
  const b = pathPoints[i];
  rawWalls.push({ x1: nx(a.x), z1: nz(a.y), x2: nx(b.x), z2: nz(b.y) });
}
for (const r of roomRects) {
  const x1 = nx(r.x);
  const z1 = nz(r.y);
  const x2 = nx(r.x + r.w);
  const z2 = nz(r.y + r.h);
  rawWalls.push(
    { x1, z1, x2, z2: z1 },
    { x1, z1: z2, x2, z2 },
    { x1, z1, x2: x1, z2 },
    { x1: x2, z1, x2, z2 },
  );
}

const walls = dedupeSegments(rawWalls);

// ---------------------------------------------------------------------------
// 3. Aberturas (interpretación documentada; el plano no las dibuja)
// ---------------------------------------------------------------------------
const openingDefs = [
  { type: 'door', axis: 'h', line: 4, from: 1.5, to: 2.7, y0: 0, y1: 2.1 },
  { type: 'door', axis: 'h', line: 4, from: 5.2, to: 6.4, y0: 0, y1: 2.1 },
  { type: 'door', axis: 'v', line: 8, from: 6.0, to: 7.2, y0: 0, y1: 2.1 },
  { type: 'window', axis: 'h', line: 9, from: 0.8, to: 2.8, y0: 0.9, y1: 2.2 },
  { type: 'window', axis: 'h', line: 9, from: 4.2, to: 6.2, y0: 0.9, y1: 2.2 },
  { type: 'window', axis: 'v', line: 11.25, from: 5.4, to: 6.6, y0: 0.9, y1: 2.2 },
  { type: 'window', axis: 'h', line: 0, from: 4.5, to: 6.5, y0: 0.9, y1: 2.2 },
  { type: 'window', axis: 'v', line: 3.75, from: 1.0, to: 2.5, y0: 0.9, y1: 2.2 },
];

const openings = openingDefs.map((o) => ({
  ...o,
  glass: o.type === 'window',
  x1: o.axis === 'h' ? o.from : o.line,
  z1: o.axis === 'h' ? o.line : o.from,
  x2: o.axis === 'h' ? o.to : o.line,
  z2: o.axis === 'h' ? o.line : o.to,
}));

const solidWalls = [];
const wallBoxes = [];
for (const w of walls) {
  const horizontal = Math.abs(w.z1 - w.z2) < 0.001;
  const axis = horizontal ? 'h' : 'v';
  const line = horizontal ? w.z1 : w.x1;
  const start = horizontal ? Math.min(w.x1, w.x2) : Math.min(w.z1, w.z2);
  const end = horizontal ? Math.max(w.x1, w.x2) : Math.max(w.z1, w.z2);
  const local = openings
    .filter((o) => o.axis === axis && Math.abs((horizontal ? o.z1 : o.x1) - line) < 0.001)
    .filter((o) => o.from >= start - 0.001 && o.to <= end + 0.001)
    .sort((a, b) => a.from - b.from);

  let cursor = start;
  for (const o of local) {
    if (o.from > cursor + 0.001) {
      const box = wallBox(axis, line, cursor, o.from, 0, WALL_HEIGHT);
      if (box) {
        wallBoxes.push(box);
        solidWalls.push({ x1: round(cursor), z1: round(line), x2: round(o.from), z2: round(line) });
      }
    }
    if (o.y0 > 0.001) {
      const sill = wallBox(axis, line, o.from, o.to, 0, o.y0, 'sill');
      if (sill) wallBoxes.push(sill);
    }
    if (o.y1 < WALL_HEIGHT - 0.001) {
      const lintel = wallBox(axis, line, o.from, o.to, o.y1, WALL_HEIGHT - o.y1, 'lintel');
      if (lintel) wallBoxes.push(lintel);
    }
    cursor = Math.max(cursor, o.to);
  }
  if (cursor < end - 0.001) {
    const box = wallBox(axis, line, cursor, end, 0, WALL_HEIGHT);
    if (box) {
      wallBoxes.push(box);
      solidWalls.push({ x1: round(cursor), z1: round(line), x2: round(end), z2: round(line) });
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Mobiliario y asientos
// ---------------------------------------------------------------------------
const CENTER_X = (salonRect.x + salaRect.x) / 2; // 294.2
const MID_SALON_X = 294.2;

function spaceCodeFor(cx, cy) {
  if (cx >= salaRect.x - 1) return 'sala-reuniones';
  if (cy < salonRect.y + salonRect.h) return 'salon';
  return 'coworking';
}

function buildSeats(furniture) {
  const seats = [];
  const { x, z, width, depth } = {
    x: furniture.position.x,
    z: furniture.position.z,
    width: furniture.size.width,
    depth: furniture.size.depth,
  };
  const push = (px, pz, rotationY) => {
    seats.push({
      id: `${furniture.code}-S${seats.length + 1}`,
      index: seats.length + 1,
      position: { x: round(px), z: round(pz) },
      rotationY,
    });
  };

  if (furniture.kind === 'pupitre') {
    push(x - 0.55, z, 90);
    return seats;
  }

  const halfWidth = width / 2;
  const offsets = [-1, 0, 1];
  for (const dz of offsets) push(x - (halfWidth + CHAIR_GAP), z + dz, 90);
  for (const dz of offsets) push(x + (halfWidth + CHAIR_GAP), z + dz, -90);

  if (furniture.kind === 'mesa_ejecutiva') {
    push(x, z - (depth / 2 + CHAIR_GAP), 0);
    push(x, z + (depth / 2 + CHAIR_GAP), 180);
  }
  return seats;
}

const furniture = [];

const tables = [...tableRects].sort((a, b) => a.cx - b.cx);
let cwIndex = 0;
let srIndex = 0;
for (const r of tables) {
  const spaceCode = spaceCodeFor(r.cx, r.cy);
  const size = rotatedSize(r.w, r.h, r.angle);
  let x = nx(r.cx);
  let z = nz(r.cy);
  let width = round(size.width * SCALE);
  let depth = round(size.depth * SCALE);
  const isMeeting = spaceCode === 'sala-reuniones';
  if (isMeeting) {
    width = 1.2;
    srIndex += 1;
  } else {
    width = 1.1;
    cwIndex += 1;
  }
  if (!isMeeting && cwIndex === 3) x = round(x + 0.25);

  const code = isMeeting ? `SR-M${srIndex}` : `CW-M${cwIndex}`;
  const label = isMeeting ? `MR${srIndex}` : `M${cwIndex}`;
  const unit = {
    code,
    label,
    spaceCode,
    kind: isMeeting ? 'mesa_ejecutiva' : 'mesa',
    capacity: 0,
    position: { x, z },
    size: { width, depth },
    rotation: 0,
    longAxis: 'z',
    svgRef: `table-${Math.round(r.cx)}-${Math.round(r.cy)}`,
    seats: [],
  };
  unit.seats = buildSeats(unit);
  unit.capacity = unit.seats.length;
  furniture.push(unit);
}

const desks = [...deskRects].sort((a, b) => {
  if (Math.abs(a.cy - b.cy) > 0.1) return a.cy - b.cy;
  return a.cx - b.cx;
});
desks.forEach((r, i) => {
  const isLeft = r.cx < MID_SALON_X;
  let x = nx(r.cx);
  const z = nz(r.cy);
  if (isLeft) x = round(x - 0.3);
  const code = `SA-D${String(i + 1).padStart(2, '0')}`;
  const unit = {
    code,
    label: `D${String(i + 1).padStart(2, '0')}`,
    spaceCode: 'salon',
    kind: 'pupitre',
    capacity: 1,
    position: { x, z },
    size: { width: round(r.w * SCALE), depth: round(r.h * SCALE) },
    rotation: 0,
    longAxis: 'x',
    svgRef: `desk-${Math.round(r.cx)}-${Math.round(r.cy)}`,
    seats: [],
  };
  unit.seats = buildSeats(unit);
  furniture.push(unit);
});

furniture.sort((a, b) => {
  const order = { coworking: 0, salon: 1, 'sala-reuniones': 2 };
  const d = (order[a.spaceCode] ?? 9) - (order[b.spaceCode] ?? 9);
  if (d !== 0) return d;
  return a.code.localeCompare(b.code);
});

for (const space of spaces) {
  const units = furniture.filter((f) => f.spaceCode === space.code);
  space.furnitureCount = units.length;
  space.capacity = units.reduce((acc, f) => acc + f.capacity, 0);
  space.seatCount = space.capacity;
}

const totalSeats = furniture.reduce((acc, f) => acc + f.capacity, 0);
if (totalSeats !== 36) {
  throw new Error(`Capacidad inesperada: ${totalSeats} asientos (se esperaban 36).`);
}

// ---------------------------------------------------------------------------
// 5. Decoración del patio de acceso
// ---------------------------------------------------------------------------
const decor = [
  { type: 'planter', position: { x: 0.55, z: 0.65 }, size: { width: 0.6, depth: 0.6 } },
  { type: 'planter', position: { x: 3.05, z: 0.65 }, size: { width: 0.6, depth: 0.6 } },
  { type: 'bench', position: { x: 1.85, z: 1.9 }, size: { width: 1.6, depth: 0.45 }, rotation: 0 },
  { type: 'sign', position: { x: 1.85, z: 3.45 }, rotation: 0 },
];

const revision = crypto
  .createHash('sha256')
  .update(svg)
  .update(JSON.stringify({ SCALE, ORIGIN, openingDefs, WALL_HEIGHT }))
  .digest('hex')
  .slice(0, 12);

const manifest = {
  revision,
  generatedAt: new Date().toISOString(),
  source: 'mapa del lugar.svg',
  scale: SCALE,
  origin: ORIGIN,
  bounds: { x: 0, z: 0, width: 11.25, depth: 9 },
  wallHeight: WALL_HEIGHT,
  wallThickness: WALL_THICKNESS,
  spaces,
  furniture,
  walls: solidWalls,
  wallBoxes,
  openings,
  decor,
  labels: [
    { text: '1: coworking', x: 59, y: 71 },
    { text: '2: aula', x: 43, y: 90 },
    { text: '3: sala de reuniones', x: 79, y: 108 },
  ],
  totals: {
    spaces: spaces.filter((s) => s.bookable).length,
    furniture: furniture.length,
    seats: totalSeats,
    desks: furniture.filter((f) => f.kind === 'pupitre').length,
    tables: furniture.filter((f) => f.kind !== 'pupitre').length,
  },
};

for (const target of TARGETS) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

console.log(
  `Plano generado (${revision}): ${manifest.totals.spaces} espacios, ` +
    `${manifest.totals.furniture} muebles, ${manifest.totals.seats} asientos, ` +
    `${wallBoxes.length} volúmenes de muro, ${openings.length} aberturas.`,
);
