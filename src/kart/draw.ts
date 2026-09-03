// Dibujo del editor y de la pista en canvas 2D. Todo en pixeles del canvas.
import { EDITOR_CELL_SIZE, EDITOR_GRID_SIZE, RAY_ANGLES, RAY_MAX_DIST } from './config.ts';
import type { TrackGeometry } from './core/contracts.ts';
import { raycastPolyline, type Vec2 } from './core/geometry.ts';
import { bboxCenter, cellCenter, type Cell } from './core/track/editor.ts';

export const WORLD_SIDE = EDITOR_GRID_SIZE * EDITOR_CELL_SIZE;

export interface Mapping {
  readonly scale: number; // px por unidad de mundo
  readonly cx: number;
  readonly cy: number;
  toPx(p: Vec2): [number, number];
}

/** La geometria viene centrada en el origen; el editor le devuelve el offset del bbox. */
export function makeMapping(canvasSize: number, ordered: ReadonlyArray<Cell>): Mapping {
  const scale = canvasSize / WORLD_SIDE;
  const { x: cx, y: cy } = ordered.length ? bboxCenter(ordered.map(cellCenter)) : { x: 0, y: 0 };
  return {
    scale,
    cx,
    cy,
    toPx: (p) => [(p.x + cx + WORLD_SIDE / 2) * scale, (p.y + cy + WORLD_SIDE / 2) * scale],
  };
}

export const COLORS = {
  bg: '#12121c',
  grid: '#1f1f2e',
  cellOk: '#233a33',
  cellBad: '#3a2330',
  asphalt: '#2a2a3a',
  edge: '#8b8ba3',
  finish: '#f5c542',
  ray: 'rgba(124, 240, 201, 0.55)',
  rayHit: '#7cf0c9',
  car: '#f5c542',
};

export function drawGrid(ctx: CanvasRenderingContext2D, size: number, cells: ReadonlySet<string>, valid: boolean) {
  const cell = size / EDITOR_GRID_SIZE;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = valid ? COLORS.cellOk : COLORS.cellBad;
  for (const key of cells) {
    const [c, r] = key.split(',').map(Number) as [number, number];
    ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
  }
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= EDITOR_GRID_SIZE; i++) {
    ctx.moveTo(i * cell + 0.5, 0);
    ctx.lineTo(i * cell + 0.5, size);
    ctx.moveTo(0, i * cell + 0.5);
    ctx.lineTo(size, i * cell + 0.5);
  }
  ctx.stroke();
}

export function drawTrack(ctx: CanvasRenderingContext2D, track: TrackGeometry, m: Mapping) {
  const path = new Path2D();
  loop(path, track.outer, m);
  loop(path, track.inner, m);
  ctx.fillStyle = COLORS.asphalt;
  ctx.fill(path, 'evenodd');
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1.5;
  ctx.stroke(path);

  // linea de llegada: el ultimo checkpoint cae sobre la largada
  const fin = track.checkpoints[track.checkpoints.length - 1]!;
  const [ax, ay] = m.toPx(fin.a);
  const [bx, by] = m.toPx(fin.b);
  ctx.strokeStyle = COLORS.finish;
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);

  // flecha de sentido
  const [sx, sy] = m.toPx(track.start.position);
  const h = track.start.heading;
  const len = 4 * m.scale;
  ctx.strokeStyle = COLORS.finish;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + Math.cos(h) * len, sy + Math.sin(h) * len);
  ctx.stroke();
}

function loop(path: Path2D, pts: ReadonlyArray<Vec2>, m: Mapping) {
  pts.forEach((p, i) => {
    const [x, y] = m.toPx(p);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  path.closePath();
}

export interface CarPose {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

/** Devuelve las distancias normalizadas (0..1) de cada rayo, y las dibuja si hay ctx. */
export function rays(track: TrackGeometry, car: CarPose, m: Mapping, ctx: CanvasRenderingContext2D | null): number[] {
  const origin = { x: car.x, y: car.y };
  const out: number[] = [];
  for (const a of RAY_ANGLES) {
    const ang = car.heading + a;
    const d = Math.min(
      raycastPolyline(origin, ang, RAY_MAX_DIST, track.inner),
      raycastPolyline(origin, ang, RAY_MAX_DIST, track.outer),
    );
    out.push(d / RAY_MAX_DIST);
    if (ctx) {
      const [x0, y0] = m.toPx(origin);
      const x1 = x0 + Math.cos(ang) * d * m.scale;
      const y1 = y0 + Math.sin(ang) * d * m.scale;
      ctx.strokeStyle = COLORS.ray;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (d < RAY_MAX_DIST) {
        ctx.fillStyle = COLORS.rayHit;
        ctx.beginPath();
        ctx.arc(x1, y1, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return out;
}

export function drawCarMarker(ctx: CanvasRenderingContext2D, car: CarPose, m: Mapping) {
  const [x, y] = m.toPx({ x: car.x, y: car.y });
  const s = 2.2 * m.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.heading);
  ctx.fillStyle = COLORS.car;
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.7, s * 0.6);
  ctx.lineTo(-s * 0.7, -s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Una pista de ejemplo: un circuito con dos escalones, para que haya algo corriendo al abrir. */
export function exampleCells(): Set<string> {
  const way: Array<[number, number]> = [
    [2, 3], [9, 3], [9, 6], [13, 6], [13, 12], [5, 12], [5, 9], [2, 9], [2, 3],
  ];
  const cells = new Set<string>();
  for (let i = 0; i < way.length - 1; i++) {
    const [c0, r0] = way[i]!;
    const [c1, r1] = way[i + 1]!;
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    cells.add(`${c},${r}`);
    while (c !== c1 || r !== r1) {
      c += dc;
      r += dr;
      cells.add(`${c},${r}`);
    }
  }
  return cells;
}
