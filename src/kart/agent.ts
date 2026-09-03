// Inferencia de la red de AutoCheems en TypeScript puro. Sin tf.js: la red es
// 6 -> 8 (relu) -> 2 (tanh), 74 pesos, y un forward por frame no justifica
// una dependencia de 1 MB. Misma matematica que el agente original.
import { GENOME_LENGTH, HIDDEN_UNITS, OBS_SIZE, OUTPUT_THRESHOLD } from './config.ts';
import type { CarAction } from './core/contracts.ts';

export interface NetworkWeights {
  readonly w1: Float32Array; // OBS_SIZE x HIDDEN_UNITS, fila = input
  readonly b1: Float32Array; // HIDDEN_UNITS
  readonly w2: Float32Array; // HIDDEN_UNITS x 2, fila = hidden
  readonly b2: Float32Array; // 2
}

export interface Activations {
  readonly inputs: Float32Array;
  readonly hidden: Float32Array;
  readonly outputs: Float32Array; // [steer, throttle] en (-1, 1)
}

export function unpackGenome(genome: ArrayLike<number>): NetworkWeights {
  if (genome.length !== GENOME_LENGTH) {
    throw new Error(`genoma de ${genome.length} pesos, se esperaban ${GENOME_LENGTH}`);
  }
  const g = Float32Array.from(genome);
  const w1Len = OBS_SIZE * HIDDEN_UNITS;
  const w2Off = w1Len + HIDDEN_UNITS;
  const b2Off = w2Off + HIDDEN_UNITS * 2;
  return {
    w1: g.subarray(0, w1Len),
    b1: g.subarray(w1Len, w2Off),
    w2: g.subarray(w2Off, b2Off),
    b2: g.subarray(b2Off, GENOME_LENGTH),
  };
}

function discretize(v: number): -1 | 0 | 1 {
  if (v > OUTPUT_THRESHOLD) return 1;
  if (v < -OUTPUT_THRESHOLD) return -1;
  return 0;
}

export function forwardActivations(net: NetworkWeights, obs: Float32Array): Activations {
  const hidden = new Float32Array(HIDDEN_UNITS);
  for (let h = 0; h < HIDDEN_UNITS; h++) {
    let sum = net.b1[h]!;
    for (let i = 0; i < OBS_SIZE; i++) sum += obs[i]! * net.w1[i * HIDDEN_UNITS + h]!;
    hidden[h] = sum > 0 ? sum : 0;
  }
  const outputs = new Float32Array(2);
  for (let o = 0; o < 2; o++) {
    let sum = net.b2[o]!;
    for (let h = 0; h < HIDDEN_UNITS; h++) sum += hidden[h]! * net.w2[h * 2 + o]!;
    outputs[o] = Math.tanh(sum);
  }
  return { inputs: obs, hidden, outputs };
}

/** Un piloto: recibe la observacion de UN auto (6 floats) y devuelve la accion. */
export function createDriver(genome: ArrayLike<number>) {
  const net = unpackGenome(genome);
  return {
    act(obs: Float32Array): CarAction {
      const { outputs } = forwardActivations(net, obs);
      return { steer: discretize(outputs[0]!), throttle: discretize(outputs[1]!) };
    },
    activations(obs: Float32Array): Activations {
      return forwardActivations(net, obs);
    },
  };
}
export type Driver = ReturnType<typeof createDriver>;
