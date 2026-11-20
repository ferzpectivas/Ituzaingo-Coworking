export interface FloorplanSeat {
  id: string;
  index: number;
  position: { x: number; z: number };
  rotationY: number;
}

export interface FloorplanFurniture {
  code: string;
  label: string;
  spaceCode: string;
  kind: 'pupitre' | 'mesa' | 'mesa_ejecutiva';
  capacity: number;
  position: { x: number; z: number };
  size: { width: number; depth: number };
  rotation: number;
  longAxis: 'x' | 'z';
  svgRef: string;
  seats: FloorplanSeat[];
}

export interface FloorplanSpace {
  code: string;
  name: string;
  description: string;
  color: string;
  accent: string;
  bookable: boolean;
  bounds: { x: number; z: number; width: number; depth: number };
  centroid: { x: number; z: number };
  labelPosition: { x: number; z: number };
  number: number;
  furnitureCount?: number;
  capacity?: number;
  seatCount?: number;
}

export interface FloorplanOpening {
  type: 'door' | 'window';
  axis: 'h' | 'v';
  line: number;
  from: number;
  to: number;
  y0: number;
  y1: number;
  glass: boolean;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface FloorplanManifest {
  revision: string;
  generatedAt: string;
  source: string;
  scale: number;
  origin: { x: number; y: number };
  bounds: { x: number; z: number; width: number; depth: number };
  wallHeight: number;
  wallThickness: number;
  spaces: FloorplanSpace[];
  furniture: FloorplanFurniture[];
  walls: Array<{ x1: number; z1: number; x2: number; z2: number }>;
  wallBoxes: Array<{
    x: number;
    z: number;
    width: number;
    depth: number;
    y: number;
    height: number;
    kind: string;
  }>;
  openings: FloorplanOpening[];
  decor: Array<{ type: string; position: { x: number; z: number }; size?: { width: number; depth: number }; rotation?: number }>;
  labels: Array<{ text: string; x: number; y: number }>;
  totals: { spaces: number; furniture: number; seats: number; desks: number; tables: number };
}
