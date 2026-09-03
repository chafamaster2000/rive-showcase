// Recorte de la config de AutoCheems: solo lo que usa la simulacion 2D y la red.
// Los valores son los mismos con los que se entreno el genoma que se embarca.

export const NUM_RAYS = 5;
export const RAY_ANGLES: readonly number[] = [
  -Math.PI / 2,
  -Math.PI / 4,
  0,
  Math.PI / 4,
  Math.PI / 2,
];
export const OBS_SIZE = NUM_RAYS + 1;
export const HIDDEN_UNITS = 8;
export const GENOME_LENGTH =
  OBS_SIZE * HIDDEN_UNITS + HIDDEN_UNITS + HIDDEN_UNITS * 2 + 2;
export const FIXED_DT = 1 / 60;
export const STAGNATION_STEPS = 300;
export const OUTPUT_THRESHOLD = 1 / 3;
export const CAR_ACCEL = 18;
export const CAR_MAX_SPEED = 22;
export const CAR_TURN_RATE = 2.8;
export const CAR_RADIUS = 0.7;
export const RAY_MAX_DIST = 25;
export const START_GRID_COLS = 1;
export const START_GRID_LAT_FRACTION = 0;
export const START_GRID_ROW_GAP = 0;
export const SPLINE_SAMPLES_PER_SEGMENT = 12;
export const CHECKPOINT_COUNT = 24;
export const EDITOR_GRID_SIZE = 16;
export const EDITOR_CELL_SIZE = 10;
export const EDITOR_TRACK_WIDTH = 6.5;
export const EDITOR_SAMPLES_PER_CELL = 8;
export const EDITOR_FILLET_MAX_CUT = 15;
export const EDITOR_CHAIKIN_ITERATIONS = 2;
export const POP_SIZE = 100;
export const MAX_GENERATION_STEPS = 3600;
export type TrackPresetName = 'facil' | 'media' | 'dificil';

export interface TrackPresetParams {
  /** Puntos de control del spline Catmull-Rom (más puntos = más curvas). */
  readonly controlPoints: number;
  /** Radio base del loop, unidades de mundo. */
  readonly radius: number;
  /** Jitter radial relativo de los puntos de control (curvatura: 0 = círculo). */
  readonly radialJitter: number;
  /** Ancho de la pista, unidades de mundo. */
  readonly width: number;
  /** Cantidad de estrangulamientos (tramos angostados). */
  readonly chokepoints: number;
  /** Factor de ancho en el estrangulamiento (1 = sin efecto). */
  readonly chokeFactor: number;
}

export const TRACK_PRESETS: Readonly<Record<TrackPresetName, TrackPresetParams>> = {
  facil: {
    controlPoints: 9,
    radius: 42,
    radialJitter: 0.32,
    width: 12,
    chokepoints: 0,
    chokeFactor: 1,
  },
  media: {
    controlPoints: 10,
    radius: 42,
    radialJitter: 0.28,
    width: 10,
    chokepoints: 2,
    chokeFactor: 0.72,
  },
  dificil: {
    controlPoints: 12,
    radius: 42,
    radialJitter: 0.4,
    width: 7.5,
    chokepoints: 3,
    chokeFactor: 0.65,
  },
};
