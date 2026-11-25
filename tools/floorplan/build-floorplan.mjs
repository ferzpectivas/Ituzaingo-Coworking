#!/usr/bin/env node
/**
 * Pipeline `mapa.drawio.svg` -> manifiesto arquitectónico JSON.
 *
 * El archivo es un export de draw.io. No se usa SVGLoader en runtime: se parsea
 * la geometría vectorial una sola vez, se normaliza a metros y se enriquece con
 * asientos y aberturas. El resultado es determinista y compartido por la vista
 * 3D, la vista 2D y la API.
 *
 * Convenciones del plano de referencia (`mapa.drawio.svg`):
 *   - polilínea negra sin relleno  -> muros exteriores
 *   - rectángulos sin relleno      -> límites del aula y de la sala de reuniones
 *   - relleno #ffcc99              -> mesas (coworking y sala de reuniones)
 *   - relleno #e51400              -> pupitres del aula
 *   - barras blancas de 9 uu       -> puertas
 *   - barra #1ba1e2                -> ventanal sobre el frente sur
 *   - tabla blanca vertical        -> pizarra del aula
 *
 * El plano está dibujado a mano y tiene desfases de hasta 2 unidades SVG
 * (5 cm) entre la polilínea exterior y los rectángulos de los ambientes: se
 * corrigen con una tolerancia de snapping documentada en `SNAP_TOLERANCE`.
 *
 * Uso: npm run floorplan
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SVG_PATH = path.join(ROOT, 'mapa.drawio.svg');
const TARGETS = [
  path.join(ROOT, 'apps/api/src/floorplan/floorplan.generated.json'),
  path.join(ROOT, 'apps/web/src/lib/floorplan.generated.json'),
];

const SCALE = 0.025; // 1 unidad del SVG = 2,5 cm
const WALL_HEIGHT = 2.6;
const WALL_THICKNESS = 0.12;
const CHAIR_GAP = 0.3;
const SNAP_TOLERANCE = 2; // unidades SVG (5 cm) para corregir el dibujo a mano
const DOOR_HEIGHT = 2.1;
const VENTANAL_BOTTOM = 0.1;
const VENTANAL_TOP = 2.4;

const round = (v, p = 4) => Number(Number(v).toFixed(p));

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
    const a = `${s.x1.toFixed(3)},${s.y1.toFixed(3)}`;
    const b = `${s.x2.toFixed(3)},${s.y2.toFixed(3)}`;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    if (Math.abs(s.x1 - s.x2) < 0.001 && Math.abs(s.y1 - s.y2) < 0.001) continue;
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

// Muros exteriores: la única polilínea sin relleno del dibujo.
const pathMatch = [...svg.matchAll(/<path\b([^>]*?)d="([^"]+)"([^>]*)>/g)].find(
  (m) => /fill="none"/.test(m[1] + m[3]) && (m[2].match(/[ML]/g) ?? []).length >= 4,
);
if (!pathMatch) throw new Error('No se encontró la polilínea de muros en el SVG.');
const pathPoints = [];
for (const m of pathMatch[2].matchAll(/[ML]\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)/g)) {
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
    const t = /rotate\(\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)\s*\)/.exec(a.transform);
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
// Las puertas son barras blancas finas (9 uu de espesor); la pizarra es una
// tabla blanca alta montada sobre el muro del aula.
const doorRects = rects.filter((r) => r.fill === '#ffffff' && r.h <= 12 && r.w >= 30);
const boardRects = rects.filter((r) => r.fill === '#ffffff' && r.h > 12);
const windowRects = rects.filter((r) => r.fill === '#1ba1e2');

if (roomRects.length !== 2) {
  throw new Error(`Se esperaban 2 rectángulos de ambiente, se encontraron ${roomRects.length}.`);
}
if (tableRects.length !== 4) {
  throw new Error(`Se esperaban 4 mesas marrones, se encontraron ${tableRects.length}.`);
}
if (deskRects.length !== 10) {
  throw new Error(`Se esperaban 10 pupitres rojos, se encontraron ${deskRects.length}.`);
}
if (doorRects.length !== 3) {
  throw new Error(`Se esperaban 3 puertas, se encontraron ${doorRects.length}.`);
}
if (boardRects.length !== 1) {
  throw new Error(`Se esperaba 1 pizarra, se encontraron ${boardRects.length}.`);
}
if (windowRects.length !== 1) {
  throw new Error(`Se esperaba 1 ventanal, se encontraron ${windowRects.length}.`);
}

const aulaRect = roomRects.find((r) => r.w === 170 && r.h === 160) ?? roomRects[0];
const salaRect = roomRects.find((r) => r !== aulaRect) ?? roomRects[1];
if (aulaRect.w !== 170 || aulaRect.h !== 160) {
  throw new Error('No se pudo identificar el aula (rectángulo de 170 x 160).');
}

// ---------------------------------------------------------------------------
// 2. Normalización: el dibujo tiene desfases de hasta 2 uu (5 cm) entre la
//    polilínea exterior y los rectángulos de los ambientes. Se ajustan las
//    coordenadas del perímetro a los bordes de los ambientes.
// ---------------------------------------------------------------------------
const xAnchors = [aulaRect.x, aulaRect.x + aulaRect.w, salaRect.x, salaRect.x + salaRect.w];
const yAnchors = [aulaRect.y, aulaRect.y + aulaRect.h, salaRect.y, salaRect.y + salaRect.h];

function snap(value, anchors) {
  let best = value;
  let bestDistance = SNAP_TOLERANCE + 1;
  for (const anchor of anchors) {
    const distance = Math.abs(value - anchor);
    if (distance <= SNAP_TOLERANCE && distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}
const snapX = (value) => snap(value, xAnchors);
const snapY = (value) => snap(value, yAnchors);

const polyline = pathPoints.map((p) => ({ x: snapX(p.x), y: snapY(p.y) }));

// Muros en unidades SVG: polilínea exterior + bordes de los rectángulos.
const rawWalls = [];
for (let i = 1; i < polyline.length; i += 1) {
  const a = polyline[i - 1];
  const b = polyline[i];
  rawWalls.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
}
for (const r of roomRects) {
  rawWalls.push(
    { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y },
    { x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h },
    { x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h },
    { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h },
  );
}
const wallsSvg = dedupeSegments(rawWalls);

const wallXs = wallsSvg.flatMap((w) => [w.x1, w.x2]);
const wallYs = wallsSvg.flatMap((w) => [w.y1, w.y2]);
const ORIGIN = { x: Math.min(...wallXs), y: Math.min(...wallYs) };

const nx = (v) => round((v - ORIGIN.x) * SCALE);
const nz = (v) => round((v - ORIGIN.y) * SCALE);

const bounds = {
  x: 0,
  z: 0,
  width: round((Math.max(...wallXs) - ORIGIN.x) * SCALE),
  depth: round((Math.max(...wallYs) - ORIGIN.y) * SCALE),
};

// ---------------------------------------------------------------------------
// 3. Aberturas: puertas y ventanal salen del propio plano y se ajustan al muro
//    más cercano con la misma orientación.
// ---------------------------------------------------------------------------
function orientedBar(r) {
  const size = rotatedSize(r.w, r.h, r.angle);
  const horizontal = size.width >= size.depth;
  const length = horizontal ? size.width : size.depth;
  const thickness = horizontal ? size.depth : size.width;
  return {
    horizontal,
    cx: r.cx,
    cy: r.cy,
    from: (horizontal ? r.cx : r.cy) - length / 2,
    to: (horizontal ? r.cx : r.cy) + length / 2,
    thickness,
  };
}

function wallsForBar(bar) {
  const line = bar.horizontal ? bar.cy : bar.cx;
  const matches = [];
  for (const wall of wallsSvg) {
    const wallHorizontal = Math.abs(wall.y1 - wall.y2) < 0.001;
    if (wallHorizontal !== bar.horizontal) continue;
    const wallLine = wallHorizontal ? wall.y1 : wall.x1;
    if (Math.abs(wallLine - line) > SNAP_TOLERANCE) continue;
    const wallFrom = wallHorizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.y1, wall.y2);
    const wallTo = wallHorizontal ? Math.max(wall.x1, wall.x2) : Math.max(wall.y1, wall.y2);
    const from = Math.max(bar.from, wallFrom);
    const to = Math.min(bar.to, wallTo);
    if (to - from < 0.5) continue;
    matches.push({ wallFrom, wallTo, line: wallLine, from, to });
  }
  return matches;
}

const snapEnd = (value, anchor) =>
  Math.abs(value - anchor) <= SNAP_TOLERANCE ? anchor : value;

const openingsSvg = [];

function addOpening(rect, type) {
  const bar = orientedBar(rect);
  const matches = wallsForBar(bar);
  if (matches.length === 0) {
    throw new Error(`La abertura ${type} no coincide con ningún muro del plano.`);
  }
  for (const match of matches) {
    const from = snapEnd(match.from, match.wallFrom);
    const to = snapEnd(match.to, match.wallTo);
    if (to - from < 1) continue;
    openingsSvg.push({
      type,
      horizontal: bar.horizontal,
      line: match.line,
      from,
      to,
      y0: type === 'door' ? 0 : VENTANAL_BOTTOM,
      y1: type === 'door' ? DOOR_HEIGHT : VENTANAL_TOP,
      glass: type === 'window',
    });
  }
}

for (const door of doorRects) addOpening(door, 'door');
for (const window of windowRects) addOpening(window, 'window');

const openings = openingsSvg.map((o) => ({
  type: o.type,
  axis: o.horizontal ? 'h' : 'v',
  line: o.horizontal ? nz(o.line) : nx(o.line),
  from: o.horizontal ? nx(o.from) : nz(o.from),
  to: o.horizontal ? nx(o.to) : nz(o.to),
  y0: o.y0,
  y1: o.y1,
  glass: o.glass,
  x1: o.horizontal ? nx(o.from) : nx(o.line),
  z1: o.horizontal ? nz(o.line) : nz(o.from),
  x2: o.horizontal ? nx(o.to) : nx(o.line),
  z2: o.horizontal ? nz(o.line) : nz(o.to),
}));

// ---------------------------------------------------------------------------
// 4. Muros en metros: cada tramo se corta según las aberturas que lo atraviesan.
// ---------------------------------------------------------------------------
const solidWalls = [];
const wallBoxes = [];
for (const w of wallsSvg) {
  const horizontal = Math.abs(w.y1 - w.y2) < 0.001;
  const axis = horizontal ? 'h' : 'v';
  const line = horizontal ? nz(w.y1) : nx(w.x1);
  const start = horizontal ? nx(Math.min(w.x1, w.x2)) : nz(Math.min(w.y1, w.y2));
  const end = horizontal ? nx(Math.max(w.x1, w.x2)) : nz(Math.max(w.y1, w.y2));

  const pushSolid = (from, to) => {
    if (to - from <= 0.001) return;
    if (horizontal) {
      solidWalls.push({ x1: round(from), z1: round(line), x2: round(to), z2: round(line) });
    } else {
      solidWalls.push({ x1: round(line), z1: round(from), x2: round(line), z2: round(to) });
    }
  };

  const local = openings
    .filter((o) => o.axis === axis && Math.abs((horizontal ? o.z1 : o.x1) - line) < 0.001)
    .map((o) => ({ ...o, from: Math.max(o.from, start), to: Math.min(o.to, end) }))
    .filter((o) => o.to - o.from > 0.001)
    .sort((a, b) => a.from - b.from);

  let cursor = start;
  for (const o of local) {
    if (o.from > cursor + 0.001) {
      const box = wallBox(axis, line, cursor, o.from, 0, WALL_HEIGHT);
      if (box) {
        wallBoxes.push(box);
        pushSolid(cursor, o.from);
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
      pushSolid(cursor, end);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Ambientes
// ---------------------------------------------------------------------------
const coworkingBoundsSvg = {
  x: Math.min(...polyline.map((p) => p.x)),
  y: Math.min(...polyline.map((p) => p.y)),
  w: Math.max(...polyline.map((p) => p.x)) - Math.min(...polyline.map((p) => p.x)),
  h: Math.max(...polyline.map((p) => p.y)) - Math.min(...polyline.map((p) => p.y)),
};

const spaceDefs = [
  {
    code: 'coworking',
    name: 'Coworking 1',
    description: 'Sala compartida con mesas colaborativas para trabajo individual o en equipo.',
    color: '#12595A',
    accent: '#E6F2F0',
    boundsSvg: coworkingBoundsSvg,
    bookable: true,
  },
  {
    code: 'salon',
    name: 'Aula de Capacitaciones',
    description: 'Aula con pizarra y pupitres individuales para capacitaciones y jornadas.',
    color: '#C9A66B',
    accent: '#F6EFE3',
    boundsSvg: { x: aulaRect.x, y: aulaRect.y, w: aulaRect.w, h: aulaRect.h },
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
      x: ORIGIN.x,
      y: aulaRect.y,
      w: aulaRect.x - ORIGIN.x,
      h: aulaRect.h,
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
// 6. Mobiliario y asientos
// ---------------------------------------------------------------------------
function spaceCodeFor(cx, cy) {
  if (cx >= salaRect.x - 1) return 'sala-reuniones';
  if (cy < aulaRect.y + aulaRect.h) return 'salon';
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
    push(x - 0.5, z, 90);
    return seats;
  }

  const halfWidth = width / 2;
  // REQ-03: la sala de reuniones admite 10 personas y el Coworking 1 llega a
  // 20. La mesa ejecutiva lleva cuatro sillas por lado; la última mesa del
  // Coworking también, para sumar los 20 puestos del relevamiento.
  const fourPerSide =
    furniture.kind === 'mesa_ejecutiva' || (furniture.kind === 'mesa' && furniture.code === 'CW-M3');
  const offsets = fourPerSide ? [-1.5, -0.5, 0.5, 1.5] : [-1, 0, 1];
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
  const isMeeting = spaceCode === 'sala-reuniones';
  const code = isMeeting ? `SR-M${++srIndex}` : `CW-M${++cwIndex}`;
  const label = isMeeting ? `MR${srIndex}` : `M${cwIndex}`;
  const unit = {
    code,
    label,
    spaceCode,
    kind: isMeeting ? 'mesa_ejecutiva' : 'mesa',
    capacity: 0,
    position: { x: nx(r.cx), z: nz(r.cy) },
    size: { width: round(size.width * SCALE), depth: round(size.depth * SCALE) },
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
  const code = `SA-D${String(i + 1).padStart(2, '0')}`;
  const unit = {
    code,
    label: `D${String(i + 1).padStart(2, '0')}`,
    spaceCode: 'salon',
    kind: 'pupitre',
    capacity: 1,
    position: { x: nx(r.cx), z: nz(r.cy) },
    size: { width: round(r.w * SCALE), depth: round(r.h * SCALE) },
    rotation: 0,
    longAxis: 'x',
    svgRef: `desk-${Math.round(r.cx)}-${Math.round(r.cy)}`,
    seats: [],
  };
  unit.seats = buildSeats(unit);
  furniture.push(unit);
});

// REQ-03: el relevamiento indica 15 pupitres en el Aula de Capacitaciones,
// mientras que el plano de referencia dibuja 10. Se completa una tercera
// columna con cinco pupitres más hasta alcanzar la capacidad real. El SVG
// fuente queda pendiente de actualización; el manifiesto es la fuente de la UI.
if (desks.length !== 10) {
  throw new Error(`Se esperaban 10 pupitres dibujados, se encontraron ${desks.length}.`);
}
const extraDeskBaseX = round(nx(desks[0].cx) - 1);
const deskRows = [...new Set(desks.map((r) => nz(r.cy)))].sort((a, b) => a - b);
deskRows.forEach((deskZ, index) => {
  const number = desks.length + index + 1;
  const code = `SA-D${String(number).padStart(2, '0')}`;
  const unit = {
    code,
    label: `D${String(number).padStart(2, '0')}`,
    spaceCode: 'salon',
    kind: 'pupitre',
    capacity: 1,
    position: { x: extraDeskBaseX, z: deskZ },
    size: { width: round(30 * SCALE), depth: round(20 * SCALE) },
    rotation: 0,
    longAxis: 'x',
    svgRef: `desk-extra-${index + 1}`,
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
if (totalSeats !== 45) {
  throw new Error(`Capacidad inesperada: ${totalSeats} asientos (se esperaban 45).`);
}

// REQ-03: capacidades del relevamiento y todos los asientos dentro de su
// ambiente, para detectar ajustes de layout inválidos al regenerar el plano.
const expectedCapacity = { coworking: 20, salon: 15, 'sala-reuniones': 10 };
for (const space of spaces.filter((s) => s.bookable)) {
  if (space.capacity !== expectedCapacity[space.code]) {
    throw new Error(
      `Capacidad inesperada en ${space.code}: ${space.capacity} (se esperaban ${expectedCapacity[space.code]}).`,
    );
  }
  const { x, z, width, depth } = space.bounds;
  for (const unit of furniture.filter((f) => f.spaceCode === space.code)) {
    for (const seat of unit.seats) {
      const out =
        seat.position.x < x - 0.01 ||
        seat.position.x > x + width + 0.01 ||
        seat.position.z < z - 0.01 ||
        seat.position.z > z + depth + 0.01;
      if (out) throw new Error(`El asiento ${seat.id} queda fuera de ${space.code}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Elementos fijos: pizarra del aula
// ---------------------------------------------------------------------------
const board = boardRects[0];
const boardSize = rotatedSize(board.w, board.h, board.angle);
const decor = [
  {
    type: 'whiteboard',
    position: { x: nx(board.cx), z: nz(board.cy) },
    size: { width: round(boardSize.width * SCALE), depth: round(boardSize.depth * SCALE) },
    rotation: 0,
  },
];

const labels = textLabels
  .filter((label) => /^\d+:\s/.test(label.text))
  .map((label) => ({ text: label.text, x: nx(label.x), y: nz(label.y) }));

const revision = crypto
  .createHash('sha256')
  .update(svg)
  .update(
    JSON.stringify({
      SCALE,
      ORIGIN,
      SNAP_TOLERANCE,
      WALL_HEIGHT,
      DOOR_HEIGHT,
      VENTANAL_BOTTOM,
      VENTANAL_TOP,
    }),
  )
  .digest('hex')
  .slice(0, 12);

const manifest = {
  revision,
  generatedAt: new Date().toISOString(),
  source: 'mapa.drawio.svg',
  scale: SCALE,
  origin: ORIGIN,
  bounds,
  wallHeight: WALL_HEIGHT,
  wallThickness: WALL_THICKNESS,
  spaces,
  furniture,
  walls: solidWalls,
  wallBoxes,
  openings,
  decor,
  labels,
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
