// Deterministic seeded PRNG (mulberry32).
export class Rng {
  private state: number
  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0
    if (this.state === 0) this.state = 0xdeadbeef
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }
  // Standard normal via Box-Muller.
  normal(mean = 0, std = 1): number {
    const u1 = Math.max(this.next(), 1e-9)
    const u2 = this.next()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + std * z
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
  // Pick from a weighted list. weights need not sum to 1.
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Smoothly map a 0..1 driver through an ease-in-out curve.
export function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}
