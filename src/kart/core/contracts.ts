// contracts.ts — el corazón del proyecto (architecture.md §4, verbatim).
// Contratos VECTORIZADOS (D1): el Environment simula N autos; un auto solo es N=1.

import type { Vec2 } from './geometry.ts';

/** Acción discreta de UN auto. */
export interface CarAction {
  steer: -1 | 0 | 1; // izquierda / recto / derecha
  throttle: -1 | 0 | 1; // frenar / nada / acelerar
}

/** Observaciones del batch, row-major: [count × OBS_SIZE], todo normalizado a [0,1].
 *  OBS_SIZE = NUM_RAYS + 1 (distancias de raycasts + velocidad). */
export interface ObservationBatch {
  readonly data: Float32Array; // length = count * OBS_SIZE
  readonly count: number;
}

export type DeathCause = 'wall' | 'stagnation';

export interface StepResult {
  observations: ObservationBatch;
  rewards: Float32Array; // delta de fitness por auto en este step
  dones: Uint8Array; // 1 = muerto (los muertos se siguen ignorando)
  allDone: boolean;
}

/** Pose y progreso de UN auto — solo lectura, para render/snapshot/debug. */
export interface CarState {
  readonly x: number;
  readonly y: number;
  readonly heading: number; // radianes
  readonly speed: number; // unidades/s
  readonly alive: boolean;
  readonly nextCheckpoint: number; // índice del próximo checkpoint a cruzar
  readonly checkpointsCrossed: number; // total acumulado (puede superar CHECKPOINT_COUNT: vueltas)
  readonly fitness: number; // checkpoints en orden + fracción de progreso (D6)
}

/** Checkpoint: segmento perpendicular al spline de la pista. */
export interface Checkpoint {
  readonly a: Vec2;
  readonly b: Vec2;
}

/** Geometría de la pista — la verdad 2D que el render dibuja tal cual (D2). */
export interface TrackGeometry {
  /** Polilínea interna, loop cerrado (último punto conecta con el primero). */
  readonly inner: ReadonlyArray<Vec2>;
  /** Polilínea externa, loop cerrado. */
  readonly outer: ReadonlyArray<Vec2>;
  /** Línea central muestreada del spline (loop cerrado). */
  readonly spline: ReadonlyArray<Vec2>;
  /** Checkpoints perpendiculares, en orden de recorrido (D6). */
  readonly checkpoints: ReadonlyArray<Checkpoint>;
  /** Pose de largada: posición sobre el spline y heading tangente. */
  readonly start: { readonly position: Vec2; readonly heading: number };
}

/** Estado del mundo para render / snapshot / debug. Solo lectura. */
export interface WorldState {
  cars: ReadonlyArray<CarState>; // pose, velocidad, vivo, checkpoint actual, fitness
  track: TrackGeometry; // polilíneas int/ext, checkpoints, spline
  step: number;
}

/** El mundo. No sabe quién lo controla ni quién lo dibuja. */
export interface Environment {
  readonly count: number;
  reset(seed: number): ObservationBatch;
  step(actions: ReadonlyArray<CarAction>): StepResult;
  getState(): WorldState;
}

/** La política. No sabe en qué mundo está. Async SIEMPRE (permite LLM/RL remotos). */
export interface Agent {
  act(observations: ObservationBatch): Promise<CarAction[]>;
  dispose?(): void; // libera recursos (tensores) si los tiene
}

/** Eventos que el Harness emite; los sinks (logger NDJSON, UI, snapshots) se suscriben. */
export interface HarnessEvents {
  onStep?(state: WorldState): void;
  onDeath?(carIndex: number, cause: DeathCause, state: WorldState): void;
  onEpisodeEnd?(stats: EpisodeStats): void;
}

export interface EpisodeStats {
  seed: number;
  steps: number;
  fitness: Float32Array; // fitness final por auto
  deaths: ReadonlyArray<{ carIndex: number; cause: DeathCause; atStep: number }>;
}

/** Acopla Environment + Agent. Episodios reproducibles. Agnóstico de todo lo demás. */
export interface Harness {
  runEpisode(seed: number, maxSteps: number): Promise<EpisodeStats>;
  /** Avanza UN step (para el loop de render con slider de velocidad). Devuelve allDone. */
  stepOnce(): Promise<boolean>;
}
