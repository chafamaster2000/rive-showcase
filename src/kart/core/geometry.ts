// geometry.ts — matemática 2D pura (D2): intersecciones analíticas y distancias.
// CERO dependencias; determinista; sin side-effects.

/** Punto o vector 2D inmutable. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Normaliza; el vector nulo devuelve (0,0) — nunca NaN. */
export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}

/** Perpendicular a 90° antihorario. */
export function perp(a: Vec2): Vec2 {
  return { x: -a.y, y: a.x };
}

/** Resultado de intersectar dos segmentos: punto y parámetro t sobre el PRIMERO. */
export interface SegmentHit {
  readonly point: Vec2;
  /** Parámetro sobre el segmento p1→p2, en [0,1]. */
  readonly t: number;
}

const EPS = 1e-12;

/**
 * Intersección segmento (p1→p2) contra segmento (p3→p4).
 * Paralelos, colineales o cruce fuera de extremos → null (nunca NaN ni falso positivo).
 */
export function segmentIntersection(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2,
): SegmentHit | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < EPS) return null; // paralelos o colineales
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null; // fuera de extremos
  return { point: { x: p1.x + t * d1x, y: p1.y + t * d1y }, t };
}

/** Distancia mínima del punto p al segmento a→b. */
export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < EPS) return distance(p, a); // segmento degenerado
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/**
 * Primer hit de un rayo (origen + ángulo, alcance maxDist) contra una polilínea
 * cerrada. Devuelve la distancia mínima o maxDist si no toca nada.
 */
export function raycastPolyline(
  origin: Vec2,
  angle: number,
  maxDist: number,
  loop: ReadonlyArray<Vec2>,
): number {
  const end: Vec2 = {
    x: origin.x + Math.cos(angle) * maxDist,
    y: origin.y + Math.sin(angle) * maxDist,
  };
  let best = maxDist;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    const hit = segmentIntersection(origin, end, a, b);
    if (hit) {
      const d = hit.t * maxDist;
      if (d < best) best = d;
    }
  }
  return best;
}

/** Distancia mínima de un punto a una polilínea cerrada. */
export function pointLoopDistance(p: Vec2, loop: ReadonlyArray<Vec2>): number {
  let best = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    const d = pointSegmentDistance(p, a, b);
    if (d < best) best = d;
  }
  return best;
}
