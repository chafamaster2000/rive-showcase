// car.ts — cinemática del auto (D2): sin inercia lateral ni derrape.
// heading += steer·CAR_TURN_RATE·dt; speed clampeada; pos += dir·speed·dt.
// Es una demo de aprendizaje, no un simulador.

import { CAR_ACCEL, CAR_MAX_SPEED, CAR_TURN_RATE } from '../config.ts';
import type { CarAction } from './contracts.ts';

/** Estado físico mínimo de un auto (interno de la sim; mutable por step). */
export interface CarPhysics {
  x: number;
  y: number;
  heading: number; // radianes
  speed: number; // unidades/s, en [0, CAR_MAX_SPEED]
}

/** Integra UN step de cinemática con timestep fijo. Muta y devuelve `car`. */
export function stepCar(car: CarPhysics, action: CarAction, dt: number): CarPhysics {
  car.heading += action.steer * CAR_TURN_RATE * dt;
  car.speed = Math.min(
    CAR_MAX_SPEED,
    Math.max(0, car.speed + action.throttle * CAR_ACCEL * dt),
  );
  car.x += Math.cos(car.heading) * car.speed * dt;
  car.y += Math.sin(car.heading) * car.speed * dt;
  return car;
}
