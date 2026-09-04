// Turns the simulation's state into the handful of numbers the road artboard
// draws itself from: how the track bends ahead, how far off the centre line the
// car is, and how far it has travelled.
import { CAR_MAX_SPEED } from './config.ts';
import type { CarState, TrackGeometry } from './core/contracts.ts';
import { distance, sub, type Vec2 } from './core/geometry.ts';

export interface RoadSignals {
  readonly curve: number; // -1 .. 1, positive bends right
  readonly lateral: number; // -1 .. 1, positive is right of the centre line
  readonly phase: number; // grows with distance, wraps in the artboard
  readonly speed: number; // 0 .. 1
}

const LOOK_AHEAD = 14;

function nearestSample(spline: ReadonlyArray<Vec2>, p: Vec2): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < spline.length; i++) {
    const d = distance(spline[i]!, p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function roadSignals(track: TrackGeometry, car: CarState, travelled: number): RoadSignals {
  const spline = track.spline;
  const n = spline.length;
  const here = nearestSample(spline, car);
  const ahead = spline[(here + LOOK_AHEAD) % n]!;
  const at = spline[here]!;

  // How far the heading has to turn to face the track a dozen samples ahead.
  const want = Math.atan2(ahead.y - at.y, ahead.x - at.x);
  let delta = want - car.heading;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  // Signed distance from the centre line, positive to the car's right.
  const off = sub(car, at);
  const right = { x: Math.sin(car.heading), y: -Math.cos(car.heading) };
  const lateral = off.x * right.x + off.y * right.y;

  return {
    curve: Math.max(-1, Math.min(1, delta / 0.6)),
    lateral: Math.max(-1, Math.min(1, lateral / 6)),
    phase: travelled * 0.35,
    speed: Math.min(1, car.speed / CAR_MAX_SPEED),
  };
}
