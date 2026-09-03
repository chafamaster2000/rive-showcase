// prng.ts — mulberry32 seedeado: LA única fuente de aleatoriedad del proyecto (D4).
// El random global de JS está prohibido en todo src/ (architecture.md §9; el hook lo bloquea).

/** Generador determinista seedeado. */
export interface Prng {
  /** Uniforme en [0, 1). */
  next(): number;
  /** Uniforme en [min, max). */
  range(min: number, max: number): number;
  /** Entero uniforme en [min, max) (max excluido). */
  int(min: number, max: number): number;
  /** Gaussiana (Box–Muller) de media 0 y desvío sigma — la usa la mutación (0002). */
  gaussian(sigma: number): number;
}

/** Crea un mulberry32 a partir de una seed entera de 32 bits. */
export function createPrng(seed: number): Prng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return min + Math.floor(next() * (max - min));
    },
    gaussian(sigma) {
      // Box–Muller: dos uniformes → una normal. u1 nunca 0 (log seguro).
      const u1 = 1 - next();
      const u2 = next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
    },
  };
}
