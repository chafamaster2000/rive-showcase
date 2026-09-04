// The driver is the part a visitor cannot see failing: if the network or the
// genome layout drifts, the car just wanders. These pin both down.
import { describe, expect, it } from 'vitest';
import { createDriver, unpackGenome } from './agent.ts';
import { TRAINED_GENOME } from './brain.ts';
import { CHECKPOINT_COUNT, GENOME_LENGTH, HIDDEN_UNITS, OBS_SIZE } from './config.ts';
import { SimEnvironment } from './core/environment.ts';
import { trackFromCells, validateCells, type Cell } from './core/track/editor.ts';
import { exampleCells } from './draw.ts';

function cells(): Cell[] {
  return [...exampleCells()].map((k) => {
    const [col, row] = k.split(',').map(Number) as [number, number];
    return { col, row };
  });
}

function drive(direction: 'ccw' | 'cw', steps = 3600) {
  const track = trackFromCells(cells(), { direction });
  const env = new SimEnvironment(1, { kind: 'custom', track }, { wallMode: 'respawn', stagnationKills: false });
  const driver = createDriver(TRAINED_GENOME);
  let obs = env.reset(0).data;
  let crashes = 0;
  for (let i = 0; i < steps; i++) {
    obs = env.step([driver.act(obs.subarray(0, OBS_SIZE))]).observations.data;
    crashes += env.drainRespawns().length;
  }
  const car = env.getState().cars[0]!;
  return { laps: car.checkpointsCrossed / CHECKPOINT_COUNT, crashes };
}

describe('the trained driver', () => {
  it('carries a genome of the size the network expects', () => {
    expect(TRAINED_GENOME).toHaveLength(GENOME_LENGTH);
    const { w1, b1, w2, b2 } = unpackGenome(TRAINED_GENOME);
    expect(w1).toHaveLength(OBS_SIZE * HIDDEN_UNITS);
    expect(b1).toHaveLength(HIDDEN_UNITS);
    expect(w2).toHaveLength(HIDDEN_UNITS * 2);
    expect(b2).toHaveLength(2);
  });

  it('only ever steers and throttles by -1, 0 or 1', () => {
    const driver = createDriver(TRAINED_GENOME);
    for (let i = 0; i < 200; i++) {
      const obs = Float32Array.from({ length: OBS_SIZE }, () => Math.random());
      const { steer, throttle } = driver.act(obs);
      expect([-1, 0, 1]).toContain(steer);
      expect([-1, 0, 1]).toContain(throttle);
    }
  });

  it('laps the example track in both directions without hitting a wall', () => {
    for (const direction of ['ccw', 'cw'] as const) {
      const { laps, crashes } = drive(direction);
      expect(crashes).toBe(0);
      expect(laps).toBeGreaterThan(3);
    }
  });

  it('is deterministic: the same track gives the same run twice', () => {
    expect(drive('ccw', 600)).toEqual(drive('ccw', 600));
  });
});

describe('the track editor', () => {
  it('accepts the example loop and rejects a broken one', () => {
    expect(validateCells(cells()).valid).toBe(true);
    expect(validateCells([{ col: 0, row: 0 }]).valid).toBe(false);
    expect(validateCells([]).valid).toBe(false);
  });

  it('closes the track: walls and centreline share a length, and it has checkpoints', () => {
    const track = trackFromCells(cells(), { direction: 'ccw' });
    expect(track.inner).toHaveLength(track.outer.length);
    expect(track.inner).toHaveLength(track.spline.length);
    expect(track.checkpoints).toHaveLength(CHECKPOINT_COUNT);
  });
});
