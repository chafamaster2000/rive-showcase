// spline.ts — pipeline compartido de pistas (D9): puntos de control →
// Catmull-Rom CERRADO → centerline muestreada → polilíneas int/ext por offset →
// checkpoints perpendiculares. Lo usan el generador procedural Y el editor.

import type { Checkpoint, TrackGeometry } from '../contracts.ts';
import { normalize, perp, sub, vec2, type Vec2 } from '../geometry.ts';

/**
 * Muestrea un Catmull-Rom uniforme CERRADO que pasa por todos los puntos de
 * control. Devuelve `control.length * samplesPerSegment` puntos (loop cerrado
 * implícito: el último conecta con el primero).
 */
export function sampleClosedCatmullRom(
  control: ReadonlyArray<Vec2>,
  samplesPerSegment: number,
): Vec2[] {
  if (control.length < 3) {
    throw new Error(`Catmull-Rom cerrado necesita ≥3 puntos de control (hay ${control.length})`);
  }
  const n = control.length;
  const out: Vec2[] = [];
  for (let seg = 0; seg < n; seg++) {
    const p0 = control[(seg - 1 + n) % n]!;
    const p1 = control[seg]!;
    const p2 = control[(seg + 1) % n]!;
    const p3 = control[(seg + 2) % n]!;
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        vec2(
          0.5 *
            (2 * p1.x +
              (-p0.x + p2.x) * t +
              (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
              (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          0.5 *
            (2 * p1.y +
              (-p0.y + p2.y) * t +
              (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
              (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        ),
      );
    }
  }
  return out;
}

/**
 * Corner-cutting de Chaikin sobre un polígono CERRADO: cada iteración
 * reemplaza cada vértice por dos puntos al 25% y 75% de sus aristas
 * (duplica la cantidad de puntos). Converge a una B-spline cuadrática:
 * preserva la forma general pero elimina esquinas.
 */
export function chaikinClosed(
  points: ReadonlyArray<Vec2>,
  iterations: number,
): Vec2[] {
  if (points.length < 3) {
    throw new Error(`Chaikin cerrado necesita ≥3 puntos (hay ${points.length})`);
  }
  let current: Vec2[] = [...points];
  for (let it = 0; it < iterations; it++) {
    const next: Vec2[] = [];
    const n = current.length;
    for (let i = 0; i < n; i++) {
      const a = current[i]!;
      const b = current[(i + 1) % n]!;
      next.push(
        vec2(a.x * 0.75 + b.x * 0.25, a.y * 0.75 + b.y * 0.25),
        vec2(a.x * 0.25 + b.x * 0.75, a.y * 0.25 + b.y * 0.75),
      );
    }
    current = next;
  }
  return current;
}

/** Área con signo (shoelace): >0 = antihorario. */
export function signedArea(loop: ReadonlyArray<Vec2>): number {
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

/** Devuelve el loop en orden antihorario (invierte si hace falta). */
export function ensureCounterClockwise(loop: ReadonlyArray<Vec2>): Vec2[] {
  return signedArea(loop) >= 0 ? [...loop] : [...loop].reverse();
}

/** Tangente unitaria en la muestra i (diferencia central sobre el loop). */
function tangentAt(centerline: ReadonlyArray<Vec2>, i: number): Vec2 {
  const n = centerline.length;
  return normalize(sub(centerline[(i + 1) % n]!, centerline[(i - 1 + n) % n]!));
}

/**
 * Construye la geometría completa de pista desde una centerline CERRADA y una
 * función de ancho por muestra. Mismo camino para presets y para pistas del
 * editor (D9). Con `forceCounterClockwise=false` la centerline se respeta tal
 * cual (el editor la usa para el sentido horario elegido, plan 0006): el orden
 * de las muestras ES el sentido de carrera — checkpoints y largada lo siguen;
 * inner/outer solo intercambian nombre, ambas polilíneas son paredes.
 */
export function buildTrackGeometry(
  centerlineInput: ReadonlyArray<Vec2>,
  widthAt: (sampleIndex: number) => number,
  checkpointCount: number,
  forceCounterClockwise = true,
): TrackGeometry {
  const centerline = forceCounterClockwise
    ? ensureCounterClockwise(centerlineInput)
    : [...centerlineInput];
  const n = centerline.length;
  const inner: Vec2[] = [];
  const outer: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const c = centerline[i]!;
    // Loop antihorario → perp(tangente) apunta hacia adentro.
    const inw = perp(tangentAt(centerline, i));
    const half = widthAt(i) / 2;
    inner.push(vec2(c.x + inw.x * half, c.y + inw.y * half));
    outer.push(vec2(c.x - inw.x * half, c.y - inw.y * half));
  }

  // Checkpoints en orden de recorrido; el último cae en la muestra 0 (línea de
  // llegada = largada), el primero queda 1/count adelante de la largada.
  const checkpoints: Checkpoint[] = [];
  for (let k = 0; k < checkpointCount; k++) {
    const i = (Math.round(((k + 1) * n) / checkpointCount)) % n;
    checkpoints.push({ a: inner[i]!, b: outer[i]! });
  }

  const start = centerline[0]!;
  const t0 = tangentAt(centerline, 0);
  return {
    inner,
    outer,
    spline: centerline,
    checkpoints,
    start: { position: start, heading: Math.atan2(t0.y, t0.x) },
  };
}
