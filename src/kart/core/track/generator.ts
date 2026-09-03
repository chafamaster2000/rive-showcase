// generator.ts — pistas procedurales por (preset, seed) (D8).
// Toma TODOS los parámetros de TRACK_PRESETS en config; nada hardcodeado.

import {
  CHECKPOINT_COUNT,
  SPLINE_SAMPLES_PER_SEGMENT,
  TRACK_PRESETS,
  type TrackPresetName,
} from '../../config.ts';
import type { TrackGeometry } from '../contracts.ts';
import { createPrng } from '../prng.ts';
import { vec2, type Vec2 } from '../geometry.ts';
import { buildTrackGeometry, sampleClosedCatmullRom } from './spline.ts';

/**
 * Genera la pista de un preset con una seed explícita. Determinista:
 * (preset, seed) → siempre exactamente la misma geometría.
 */
export function generateTrack(preset: TrackPresetName, seed: number): TrackGeometry {
  const params = TRACK_PRESETS[preset];
  const prng = createPrng(seed);

  // Puntos de control: ángulos equiespaciados, radio con jitter seedeado.
  const control: Vec2[] = [];
  for (let i = 0; i < params.controlPoints; i++) {
    const angle = (i / params.controlPoints) * 2 * Math.PI;
    const jitter = 1 + prng.range(-params.radialJitter, params.radialJitter);
    const r = params.radius * jitter;
    control.push(vec2(Math.cos(angle) * r, Math.sin(angle) * r));
  }

  const centerline = sampleClosedCatmullRom(control, SPLINE_SAMPLES_PER_SEGMENT);
  const n = centerline.length;

  // Estrangulamientos (D8): centros elegidos por PRNG, angostan el ancho con
  // falloff coseno suave en una ventana de ±windowHalf muestras.
  const chokeCenters: number[] = [];
  for (let c = 0; c < params.chokepoints; c++) {
    chokeCenters.push(prng.int(0, n));
  }
  const windowHalf = Math.floor(n / 16);

  const widthAt = (i: number): number => {
    let w = params.width;
    for (const center of chokeCenters) {
      // Distancia circular en muestras.
      const raw = Math.abs(i - center);
      const d = Math.min(raw, n - raw);
      if (d < windowHalf) {
        // Falloff coseno: 1 en el borde de la ventana → chokeFactor en el centro.
        const tt = d / windowHalf;
        const factor =
          params.chokeFactor + (1 - params.chokeFactor) * (1 - Math.cos(tt * Math.PI)) * 0.5;
        w = Math.min(w, params.width * factor);
      }
    }
    return w;
  };

  return buildTrackGeometry(centerline, widthAt, CHECKPOINT_COUNT);
}
