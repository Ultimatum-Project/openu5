/**
 * RNG determinista para combate y encuentros. Congruencia lineal (mismo patrón
 * que `npc/manager.ts:lcg`), reproducible al sembrar con una semilla fija.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }

  /** Siguiente flotante en [0, 1). */
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 0x100000000;
  }

  /** Entero en [0, n). */
  int(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }

  /** Entero en [min, max] inclusive. */
  range(min: number, max: number): number {
    if (max <= min) return min;
    return min + this.int(max - min + 1);
  }

  /** `_random.Next(255)` de Redux: entero en [0, 254]. */
  next255(): number {
    return this.int(255);
  }

  /** 1 probabilidad entre n (Utils.OneInXOdds). */
  oneIn(n: number): boolean {
    return this.int(n) === 0;
  }

  /** Baraja Fisher-Yates in situ (CreateRandomizedIntegerQueue). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }
}
