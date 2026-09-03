// environment.ts — el mundo (contrato §4): N autos, pista, raycasts, muertes
// (D5: pared + estancamiento), fitness por checkpoints EN ORDEN (D6).
// No sabe quién lo controla ni quién lo dibuja.
//
// Nota de performance (interna, determinista): los raycasts y la colisión no
// barren TODA la polilínea — usan una ventana de índices alrededor de la
// muestra del spline más cercana a cada auto (el mapeo índice↔arco es válido
// porque inner/outer son offsets de la centerline). El slider 1x–100x del
// browser depende de esto (D2).

import {
  CAR_MAX_SPEED,
  CAR_RADIUS,
  FIXED_DT,
  NUM_RAYS,
  OBS_SIZE,
  RAY_ANGLES,
  RAY_MAX_DIST,
  STAGNATION_STEPS,
  START_GRID_COLS,
  START_GRID_LAT_FRACTION,
  START_GRID_ROW_GAP,
  type TrackPresetName,
} from '../config.ts';
import { stepCar, type CarPhysics } from './car.ts';
import type {
  CarAction,
  CarState,
  DeathCause,
  Environment,
  ObservationBatch,
  StepResult,
  TrackGeometry,
  WorldState,
} from './contracts.ts';
import {
  distance,
  pointSegmentDistance,
  segmentIntersection,
  vec2,
  type Vec2,
} from './geometry.ts';
import { generateTrack } from './track/generator.ts';

/** Fuente de pista: preset procedural (seedeable) o geometría ya construida (editor). */
export type TrackSource =
  | { readonly kind: 'preset'; readonly preset: TrackPresetName }
  | { readonly kind: 'custom'; readonly track: TrackGeometry };

/** Reglas del episodio. El default reproduce EXACTO el comportamiento de
 *  evolución (D5: pared y estancamiento matan); el modo carrera (plan 0005)
 *  usa respawn en el último checkpoint y sin estancamiento. */
export interface EnvironmentOptions {
  /** 'kill': la pared mata (D5.1). 'respawn': volver al último checkpoint, velocidad 0. */
  readonly wallMode: 'kill' | 'respawn';
  /** Si false, no existe la muerte por estancamiento (D5.2). */
  readonly stagnationKills: boolean;
}

const DEFAULT_OPTIONS: EnvironmentOptions = { wallMode: 'kill', stagnationKills: true };

interface SimCar extends CarPhysics {
  alive: boolean;
  nextCheckpoint: number;
  checkpointsCrossed: number;
  stepsSinceCheckpoint: number;
  fitness: number;
  nearestSample: number; // índice de muestra del spline más cercano (ventana)
  deathCause: DeathCause | null;
}

/** Muertes ocurridas en el último step (el harness las convierte en eventos). */
export interface StepDeath {
  readonly carIndex: number;
  readonly cause: DeathCause;
}

export class SimEnvironment implements Environment {
  readonly count: number;
  private readonly source: TrackSource;
  private readonly options: EnvironmentOptions;
  private track: TrackGeometry | null = null;
  private cars: SimCar[] = [];
  private stepCount = 0;
  private windowHalf = 0; // ventana de índices para raycast/colisión
  private cpMidpoints: Vec2[] = [];
  private lastDeaths: StepDeath[] = [];
  private lastRespawns: number[] = [];

  constructor(count: number, source: TrackSource, options: EnvironmentOptions = DEFAULT_OPTIONS) {
    this.count = count;
    this.source = source;
    this.options = options;
  }

  /** Muertes del último step — para el harness (no es parte del contrato §4). */
  drainDeaths(): StepDeath[] {
    const d = this.lastDeaths;
    this.lastDeaths = [];
    return d;
  }

  /** Índices de autos respawneados en el último step (solo wallMode='respawn'). */
  drainRespawns(): number[] {
    const r = this.lastRespawns;
    this.lastRespawns = [];
    return r;
  }

  reset(seed: number): ObservationBatch {
    this.track =
      this.source.kind === 'preset'
        ? generateTrack(this.source.preset, seed)
        : this.source.track;
    this.stepCount = 0;
    this.lastDeaths = [];
    this.lastRespawns = [];

    const { spline, checkpoints, start, inner, outer } = this.track;
    this.cpMidpoints = checkpoints.map((cp) =>
      vec2((cp.a.x + cp.b.x) / 2, (cp.a.y + cp.b.y) / 2),
    );

    // Ventana: cuántos índices de muestra cubren RAY_MAX_DIST sobre el arco.
    let minSpacing = Infinity;
    for (let i = 0; i < spline.length; i++) {
      const d = distance(spline[i]!, spline[(i + 1) % spline.length]!);
      if (d < minSpacing) minSpacing = d;
    }
    this.windowHalf = Math.min(
      Math.ceil((RAY_MAX_DIST * 1.25) / minSpacing) + 2,
      Math.floor(spline.length / 2),
    );

    // Grilla de largada: filas hacia atrás de la línea, spread lateral (D2:
    // fantasmas entre sí — el spread es teatro determinista, sin PRNG).
    const width0 = distance(inner[0]!, outer[0]!);
    const cos = Math.cos(start.heading);
    const sin = Math.sin(start.heading);
    const latX = -sin;
    const latY = cos;
    this.cars = [];
    for (let i = 0; i < this.count; i++) {
      const col = i % START_GRID_COLS;
      const row = Math.floor(i / START_GRID_COLS);
      const latDenom = START_GRID_COLS - 1;
      const lat =
        latDenom <= 0 ? 0 : (col / latDenom - 0.5) * width0 * START_GRID_LAT_FRACTION;
      const back = row * CAR_RADIUS * START_GRID_ROW_GAP;
      this.cars.push({
        x: start.position.x + latX * lat - cos * back,
        y: start.position.y + latY * lat - sin * back,
        heading: start.heading,
        speed: 0,
        alive: true,
        nextCheckpoint: 0,
        checkpointsCrossed: 0,
        stepsSinceCheckpoint: 0,
        fitness: 0,
        nearestSample: 0,
        deathCause: null,
      });
    }
    for (const car of this.cars) this.updateNearestSample(car);
    return this.buildObservations();
  }

  step(actions: ReadonlyArray<CarAction>): StepResult {
    const track = this.requireTrack();
    if (actions.length !== this.count) {
      throw new Error(`step: esperaba ${this.count} acciones, llegaron ${actions.length}`);
    }
    const rewards = new Float32Array(this.count);
    const dones = new Uint8Array(this.count);
    this.lastDeaths = [];
    this.lastRespawns = [];

    for (let i = 0; i < this.count; i++) {
      const car = this.cars[i]!;
      if (!car.alive) {
        dones[i] = 1;
        continue;
      }
      const before = car.fitness;
      const prevX = car.x;
      const prevY = car.y;
      stepCar(car, actions[i]!, FIXED_DT);
      this.updateNearestSample(car);

      // Pared: mata (D5.1) o respawnea en el último checkpoint (modo carrera).
      if (this.wallDistance(car) < CAR_RADIUS) {
        if (this.options.wallMode === 'kill') {
          this.kill(i, 'wall');
          dones[i] = 1;
          rewards[i] = car.fitness - before;
          continue;
        }
        this.respawn(i);
        rewards[i] = car.fitness - before;
        continue;
      }

      // Cruce del PRÓXIMO checkpoint (en orden — D6): el segmento de
      // movimiento del step interseca el segmento del checkpoint esperado.
      const cp = track.checkpoints[car.nextCheckpoint]!;
      if (segmentIntersection(vec2(prevX, prevY), vec2(car.x, car.y), cp.a, cp.b)) {
        car.checkpointsCrossed++;
        car.nextCheckpoint = (car.nextCheckpoint + 1) % track.checkpoints.length;
        car.stepsSinceCheckpoint = 0;
      } else {
        car.stepsSinceCheckpoint++;
      }

      // Muerte por estancamiento (D5.2) — apagable en modo carrera.
      if (this.options.stagnationKills && car.stepsSinceCheckpoint > STAGNATION_STEPS) {
        this.kill(i, 'stagnation');
        dones[i] = 1;
        rewards[i] = car.fitness - before;
        continue;
      }

      // Fitness D6: checkpoints EN ORDEN + fracción de progreso al próximo.
      car.fitness = car.checkpointsCrossed + this.progressFraction(car);
      rewards[i] = car.fitness - before;
    }

    this.stepCount++;
    const allDone = this.cars.every((c) => !c.alive);
    return { observations: this.buildObservations(), rewards, dones, allDone };
  }

  getState(): WorldState {
    const track = this.requireTrack();
    const cars: CarState[] = this.cars.map((c) => ({
      x: c.x,
      y: c.y,
      heading: c.heading,
      speed: c.speed,
      alive: c.alive,
      nextCheckpoint: c.nextCheckpoint,
      checkpointsCrossed: c.checkpointsCrossed,
      fitness: c.fitness,
    }));
    return { cars, track, step: this.stepCount };
  }

  // ── internos ──────────────────────────────────────────────────────────────

  private requireTrack(): TrackGeometry {
    if (!this.track) throw new Error('Environment sin reset(): no hay pista');
    return this.track;
  }

  private kill(index: number, cause: DeathCause): void {
    const car = this.cars[index]!;
    car.alive = false;
    car.deathCause = cause;
    car.speed = 0;
    this.lastDeaths.push({ carIndex: index, cause });
  }

  /** Vuelta al último checkpoint cruzado (o la largada), velocidad 0, mirando
   *  al próximo checkpoint. Conserva checkpointsCrossed: chocar penaliza con
   *  el trayecto perdido, no con la carrera. */
  private respawn(index: number): void {
    const track = this.requireTrack();
    const car = this.cars[index]!;
    const mids = this.cpMidpoints;
    const next = mids[car.nextCheckpoint]!;
    if (car.checkpointsCrossed === 0) {
      car.x = track.start.position.x;
      car.y = track.start.position.y;
      car.heading = track.start.heading;
    } else {
      const last = mids[(car.nextCheckpoint - 1 + mids.length) % mids.length]!;
      car.x = last.x;
      car.y = last.y;
      car.heading = Math.atan2(next.y - last.y, next.x - last.x);
    }
    car.speed = 0;
    car.stepsSinceCheckpoint = 0;
    // Scan completo (no hill-climb): el salto puede ser largo y el hill-climb
    // se quedaría en un mínimo local de una pista contorsionada.
    const spline = track.spline;
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < spline.length; s++) {
      const d = distance(vec2(car.x, car.y), spline[s]!);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    car.nearestSample = best;
    car.fitness = car.checkpointsCrossed + this.progressFraction(car);
    this.lastRespawns.push(index);
  }

  /** Hill-climb del índice de muestra más cercano (movimiento por step << spacing). */
  private updateNearestSample(car: SimCar): void {
    const spline = this.requireTrack().spline;
    const n = spline.length;
    let best = car.nearestSample;
    let bestD = distance(vec2(car.x, car.y), spline[best]!);
    for (;;) {
      let improved = false;
      for (const delta of [1, n - 1]) {
        const cand = (best + delta) % n;
        const d = distance(vec2(car.x, car.y), spline[cand]!);
        if (d < bestD) {
          best = cand;
          bestD = d;
          improved = true;
        }
      }
      if (!improved) break;
    }
    car.nearestSample = best;
  }

  /** Distancia mínima del auto a ambas paredes, mirando solo la ventana local. */
  private wallDistance(car: SimCar): number {
    const { inner, outer } = this.requireTrack();
    const n = inner.length;
    const p = vec2(car.x, car.y);
    let best = Infinity;
    for (let k = -this.windowHalf; k < this.windowHalf; k++) {
      const i = (car.nearestSample + k + n) % n;
      const j = (i + 1) % n;
      const dIn = pointSegmentDistance(p, inner[i]!, inner[j]!);
      if (dIn < best) best = dIn;
      const dOut = pointSegmentDistance(p, outer[i]!, outer[j]!);
      if (dOut < best) best = dOut;
    }
    return best;
  }

  /** Raycast contra ambas paredes dentro de la ventana local. */
  private raycast(car: SimCar, angle: number): number {
    const { inner, outer } = this.requireTrack();
    const n = inner.length;
    const origin = vec2(car.x, car.y);
    const end = vec2(
      car.x + Math.cos(angle) * RAY_MAX_DIST,
      car.y + Math.sin(angle) * RAY_MAX_DIST,
    );
    let best = RAY_MAX_DIST;
    for (let k = -this.windowHalf; k < this.windowHalf; k++) {
      const i = (car.nearestSample + k + n) % n;
      const j = (i + 1) % n;
      const hitIn = segmentIntersection(origin, end, inner[i]!, inner[j]!);
      if (hitIn) {
        const d = hitIn.t * RAY_MAX_DIST;
        if (d < best) best = d;
      }
      const hitOut = segmentIntersection(origin, end, outer[i]!, outer[j]!);
      if (hitOut) {
        const d = hitOut.t * RAY_MAX_DIST;
        if (d < best) best = d;
      }
    }
    return best;
  }

  /** Fracción de progreso hacia el próximo checkpoint, en [0, 1). */
  private progressFraction(car: SimCar): number {
    const mids = this.cpMidpoints;
    const track = this.requireTrack();
    const next = mids[car.nextCheckpoint]!;
    const prevPoint =
      car.checkpointsCrossed === 0
        ? track.start.position
        : mids[(car.nextCheckpoint - 1 + mids.length) % mids.length]!;
    const gap = distance(prevPoint, next);
    if (gap === 0) return 0;
    const remaining = distance(vec2(car.x, car.y), next);
    const frac = 1 - remaining / gap;
    return Math.max(0, Math.min(0.999, frac * 0.999));
  }

  /** Observaciones [count × OBS_SIZE] normalizadas a [0,1]; muertos = ceros. */
  private buildObservations(): ObservationBatch {
    const data = new Float32Array(this.count * OBS_SIZE);
    for (let i = 0; i < this.count; i++) {
      const car = this.cars[i]!;
      if (!car.alive) continue; // ceros
      const base = i * OBS_SIZE;
      for (let r = 0; r < NUM_RAYS; r++) {
        const d = this.raycast(car, car.heading + RAY_ANGLES[r]!);
        data[base + r] = d / RAY_MAX_DIST;
      }
      data[base + NUM_RAYS] = car.speed / CAR_MAX_SPEED;
    }
    return { data, count: this.count };
  }
}
