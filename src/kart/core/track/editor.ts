// editor.ts — validador del editor tile-based (D9 + ADR 0002): las celdas
// pintadas son válidas si forman UN loop cerrado donde cada celda tiene
// exactamente 2 vecinas. La vecindad es 8-conexa con la regla de ortogonal
// común: una diagonal A–B cuenta SOLO si ninguna de las dos celdas ortogonales
// comunes está pintada — eso anula diagonales redundantes, hace imposible el
// cruce en X y mantiene la peor esquina en 90° (ver ADR 0002). La grilla ES la
// validación. Celdas válidas → centros centrados por bbox → suavizado fuerte
// (colineales fuera + fillet de esquinas + Chaikin) → MISMO pipeline de
// spline. La grilla valida; la curva no tiene por qué calcar la grilla.

import {
  CHECKPOINT_COUNT,
  EDITOR_CELL_SIZE,
  EDITOR_CHAIKIN_ITERATIONS,
  EDITOR_FILLET_MAX_CUT,
  EDITOR_GRID_SIZE,
  EDITOR_SAMPLES_PER_CELL,
  EDITOR_TRACK_WIDTH,
} from '../../config.ts';
import type { TrackGeometry } from '../contracts.ts';
import { vec2, type Vec2 } from '../geometry.ts';
import {
  buildTrackGeometry,
  chaikinClosed,
  ensureCounterClockwise,
  sampleClosedCatmullRom,
} from './spline.ts';

/** Celda pintada de la grilla del editor. */
export interface Cell {
  readonly col: number;
  readonly row: number;
}

export type EditorValidation =
  | { valid: true; ordered: Cell[] }
  | { valid: false; reason: string };

const key = (c: Cell): string => `${c.col},${c.row}`;

/**
 * Vecinas presentes en el set (ADR 0002): las 4 ortogonales siempre cuentan;
 * una diagonal cuenta SOLO si ninguna de sus dos ortogonales comunes está
 * pintada (si lo estuviera, el camino válido es el ortogonal y la diagonal
 * sería redundante/ambigua).
 */
function neighbors(cell: Cell, cells: ReadonlySet<string>): Cell[] {
  const found: Cell[] = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const c = { col: cell.col + dc, row: cell.row + dr };
    if (cells.has(key(c))) found.push(c);
  }
  for (const [dc, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const c = { col: cell.col + dc, row: cell.row + dr };
    if (!cells.has(key(c))) continue;
    const commonA = { col: cell.col + dc, row: cell.row };
    const commonB = { col: cell.col, row: cell.row + dr };
    if (!cells.has(key(commonA)) && !cells.has(key(commonB))) found.push(c);
  }
  return found;
}

/**
 * Valida las celdas pintadas (D9). Válido ⇔ UN solo loop cerrado con
 * exactamente 2 vecinas ortogonales por celda. Devuelve las celdas ordenadas
 * como recorrido del loop, o el motivo del rechazo.
 */
export function validateCells(cells: ReadonlyArray<Cell>): EditorValidation {
  if (cells.length === 0) {
    return { valid: false, reason: 'grilla vacía: no hay celdas pintadas' };
  }
  if (cells.length < 4) {
    return { valid: false, reason: `un loop cerrado necesita ≥4 celdas (hay ${cells.length})` };
  }

  const set = new Set<string>();
  for (const c of cells) {
    if (
      c.col < 0 || c.col >= EDITOR_GRID_SIZE ||
      c.row < 0 || c.row >= EDITOR_GRID_SIZE
    ) {
      return { valid: false, reason: `celda (${c.col},${c.row}) fuera de la grilla ${EDITOR_GRID_SIZE}×${EDITOR_GRID_SIZE}` };
    }
    if (set.has(key(c))) {
      return { valid: false, reason: `celda (${c.col},${c.row}) repetida` };
    }
    set.add(key(c));
  }

  // Cada celda: exactamente 2 vecinas (ortogonales o diagonales que cuentan).
  for (const c of cells) {
    const n = neighbors(c, set).length;
    if (n !== 2) {
      return {
        valid: false,
        reason:
          `celda (${c.col},${c.row}) tiene ${n} vecina(s); un loop exige exactamente 2 ` +
          '(una diagonal no cuenta si alguna de sus ortogonales comunes está pintada)',
      };
    }
  }

  // Caminar el loop desde la primera celda; si no visita todas → hay ≥2 loops.
  const startCell = cells[0]!;
  const ordered: Cell[] = [startCell];
  const visited = new Set<string>([key(startCell)]);
  let prev: Cell | null = null;
  let current = startCell;
  for (;;) {
    const nexts = neighbors(current, set).filter(
      (c) => !(prev && key(c) === key(prev)),
    );
    // Con exactamente 2 vecinas por celda siempre hay una sola "siguiente"
    // (salvo el primer paso, donde elegimos cualquiera de las dos).
    const next = nexts[0];
    if (!next) break; // no debería pasar con la invariante de 2 vecinas
    if (key(next) === key(startCell)) break; // loop cerrado
    if (visited.has(key(next))) break; // seguridad
    ordered.push(next);
    visited.add(key(next));
    prev = current;
    current = next;
  }

  if (ordered.length !== cells.length) {
    return {
      valid: false,
      reason: `las celdas forman ${cells.length - ordered.length ? 'más de un loop' : 'un loop incompleto'}: el recorrido cubre ${ordered.length} de ${cells.length}`,
    };
  }

  return { valid: true, ordered };
}

/** Centro de una celda en unidades de mundo (grilla centrada en el origen). */
export function cellCenter(cell: Cell): Vec2 {
  const half = (EDITOR_GRID_SIZE * EDITOR_CELL_SIZE) / 2;
  return vec2(
    (cell.col + 0.5) * EDITOR_CELL_SIZE - half,
    (cell.row + 0.5) * EDITOR_CELL_SIZE - half,
  );
}

/** ¿b está sobre la recta a→c? (los centros viven en una grilla: alcanza el área). */
function isCollinear(a: Vec2, b: Vec2, c: Vec2): boolean {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-9;
}

/** Elimina puntos consecutivos (con wrap) a distancia despreciable. */
function dedupeConsecutive(points: ReadonlyArray<Vec2>): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-6) continue;
    out.push(p);
  }
  const first = out[0]!;
  const last = out[out.length - 1]!;
  if (out.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) {
    out.pop();
  }
  return out;
}

/**
 * Suavizado fuerte de los centros de celda ANTES del spline:
 * 1. descarta los centros colineales (las rectas dejan de anclar la curva a
 *    la grilla celda a celda);
 * 2. redondea cada esquina de 90° con un fillet: en vez de pasar por el
 *    centro de la celda-esquina, la curva entra y sale a
 *    min(EDITOR_FILLET_MAX_CUT, mitad del tramo) de distancia — el radio de
 *    giro escala con el largo de las rectas disponibles;
 * 3. Chaikin sobre el polígono filleteado para alisar los chaflanes.
 * El resultado alimenta el MISMO pipeline Catmull-Rom→polilíneas (D9).
 */
function smoothControlPoints(centers: ReadonlyArray<Vec2>): Vec2[] {
  const n = centers.length;
  // 1. Solo las esquinas (un loop rectilíneo cerrado siempre tiene ≥4).
  const corners = centers.filter((_, i) =>
    !isCollinear(centers[(i - 1 + n) % n]!, centers[i]!, centers[(i + 1) % n]!),
  );

  // 2. Fillet: dos puntos por esquina, sobre cada arista adyacente.
  const filleted: Vec2[] = [];
  const m = corners.length;
  for (let i = 0; i < m; i++) {
    const prev = corners[(i - 1 + m) % m]!;
    const c = corners[i]!;
    const next = corners[(i + 1) % m]!;
    const inLen = Math.hypot(c.x - prev.x, c.y - prev.y);
    const outLen = Math.hypot(next.x - c.x, next.y - c.y);
    const cutIn = Math.min(EDITOR_FILLET_MAX_CUT, inLen / 2);
    const cutOut = Math.min(EDITOR_FILLET_MAX_CUT, outLen / 2);
    filleted.push(
      vec2(c.x + ((prev.x - c.x) / inLen) * cutIn, c.y + ((prev.y - c.y) / inLen) * cutIn),
      vec2(c.x + ((next.x - c.x) / outLen) * cutOut, c.y + ((next.y - c.y) / outLen) * cutOut),
    );
  }

  // 3. Cortes que se encuentran en el medio de un tramo → punto duplicado.
  return chaikinClosed(dedupeConsecutive(filleted), EDITOR_CHAIKIN_ITERATIONS);
}

/** Centro del bounding box de un conjunto de puntos (útil también para la UI:
 *  es el offset que trackFromCells le resta a la geometría al centrarla). */
export function bboxCenter(points: ReadonlyArray<Vec2>): Vec2 {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return vec2((minX + maxX) / 2, (minY + maxY) / 2);
}

/** Opciones del editor (grilling 0006 bis): dónde arranca la carrera y en qué
 *  sentido se corre. Defaults = comportamiento previo (sample 0, antihorario). */
export interface TrackFromCellsOptions {
  /** Celda pintada donde cae la largada/llegada (la más cercana en la curva). */
  readonly startCell?: Cell;
  /** Sentido de carrera: antihorario (default) u horario. */
  readonly direction?: 'ccw' | 'cw';
}

/**
 * Celdas válidas → pista, por el MISMO camino spline→polilíneas→checkpoints
 * que los presets (D9), con centrado por bbox y suavizado fuerte de esquinas
 * previo al spline. La largada elegida rota la centerline (la muestra 0 ES la
 * largada/llegada) y el sentido horario la revierte — checkpoints y heading
 * siguen el orden de las muestras. Lanza si las celdas no validan.
 */
export function trackFromCells(
  cells: ReadonlyArray<Cell>,
  options: TrackFromCellsOptions = {},
): TrackGeometry {
  const result = validateCells(cells);
  if (!result.valid) {
    throw new Error(`celdas inválidas: ${result.reason}`);
  }
  const rawCenters = result.ordered.map(cellCenter);
  const offset = bboxCenter(rawCenters);
  const centered = rawCenters.map((p) => vec2(p.x - offset.x, p.y - offset.y));
  const control = smoothControlPoints(centered);
  // Densidad objetivo constante: ≈ EDITOR_SAMPLES_PER_CELL muestras por celda
  // pintada, repartidas entre los puntos de control ya suavizados.
  const samplesPerSegment = Math.max(
    2,
    Math.round((result.ordered.length * EDITOR_SAMPLES_PER_CELL) / control.length),
  );
  // Sentido y largada se resuelven SOBRE la centerline ya normalizada: así el
  // default es idéntico al comportamiento previo (ensure + sample 0).
  let centerline = ensureCounterClockwise(sampleClosedCatmullRom(control, samplesPerSegment));
  if (options.direction === 'cw') centerline = centerline.reverse();
  if (options.startCell) {
    const raw = cellCenter(options.startCell);
    const target = vec2(raw.x - offset.x, raw.y - offset.y);
    let bestIdx = 0;
    let bestDist = Infinity;
    centerline.forEach((p, i) => {
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    centerline = [...centerline.slice(bestIdx), ...centerline.slice(0, bestIdx)];
  }
  return buildTrackGeometry(centerline, () => EDITOR_TRACK_WIDTH, CHECKPOINT_COUNT, false);
}
