import { BaseEngine, CuratedPreset } from './BaseEngine'
import type { EngineContext, EngineId, PointBuffer } from '../types'
import { Rng } from '../utils/random'

// Simplified Fractal Flame — a small IFS where each transform is a 2x3
// affine matrix composed with one of a handful of nonlinear variations.
// We pick a few well-curated transform combinations.

type Variation = 'linear' | 'sinusoidal' | 'spherical' | 'swirl' | 'horseshoe' | 'polar' | 'heart'
const VARIATIONS: Variation[] = ['linear', 'sinusoidal', 'spherical', 'swirl', 'horseshoe', 'polar', 'heart']

interface Affine {
  a: number; b: number; c: number
  d: number; e: number; f: number
  prob: number
  hue: number
  v: Variation
}

interface FlamePreset {
  transforms: Affine[]
}

const FLAMES: FlamePreset[] = [
  {
    transforms: [
      { a: 0.5, b: 0, c: 0, d: 0, e: 0.5, f: 0, prob: 0.33, hue: 0.0, v: 'sinusoidal' },
      { a: 0.5, b: 0, c: 0.5, d: 0, e: 0.5, f: 0, prob: 0.33, hue: 0.5, v: 'spherical' },
      { a: 0.5, b: 0, c: 0, d: 0, e: 0.5, f: 0.5, prob: 0.34, hue: 0.8, v: 'swirl' },
    ],
  },
  {
    transforms: [
      { a: 0.6, b: -0.3, c: 0.1, d: 0.3, e: 0.6, f: 0, prob: 0.4, hue: 0.1, v: 'horseshoe' },
      { a: -0.5, b: 0.2, c: 0, d: -0.2, e: -0.5, f: 0, prob: 0.3, hue: 0.6, v: 'polar' },
      { a: 0.3, b: 0.0, c: 0.0, d: 0.0, e: 0.3, f: 0.0, prob: 0.3, hue: 0.85, v: 'heart' },
    ],
  },
  {
    transforms: [
      { a: 0.7, b: 0.3, c: 0, d: -0.3, e: 0.7, f: 0, prob: 0.5, hue: 0.05, v: 'swirl' },
      { a: 0.3, b: -0.6, c: 0.4, d: 0.6, e: 0.3, f: -0.4, prob: 0.5, hue: 0.55, v: 'spherical' },
    ],
  },
  {
    transforms: [
      { a: 0.45, b: 0, c: 0.1, d: 0, e: 0.45, f: 0.1, prob: 0.25, hue: 0.0, v: 'sinusoidal' },
      { a: 0.45, b: 0, c: -0.1, d: 0, e: 0.45, f: 0.1, prob: 0.25, hue: 0.25, v: 'horseshoe' },
      { a: 0.45, b: 0, c: -0.1, d: 0, e: 0.45, f: -0.1, prob: 0.25, hue: 0.5, v: 'polar' },
      { a: 0.45, b: 0, c: 0.1, d: 0, e: 0.45, f: -0.1, prob: 0.25, hue: 0.75, v: 'swirl' },
    ],
  },
]

// We store the preset index and a tiny per-transform jitter inside the
// internal coefficients so mutate() / interpolate() still work.
const PRESETS: CuratedPreset[] = FLAMES.map((f, i) => {
  const internal: Record<string, number> = { flameIndex: i }
  for (let ti = 0; ti < f.transforms.length; ti++) {
    const t = f.transforms[ti]
    internal[`t${ti}_a`] = t.a
    internal[`t${ti}_b`] = t.b
    internal[`t${ti}_c`] = t.c
    internal[`t${ti}_d`] = t.d
    internal[`t${ti}_e`] = t.e
    internal[`t${ti}_f`] = t.f
    internal[`t${ti}_hue`] = t.hue
  }
  return { internal }
})

function applyVariation(v: Variation, x: number, y: number): [number, number] {
  switch (v) {
    case 'linear':
      return [x, y]
    case 'sinusoidal':
      return [Math.sin(x), Math.sin(y)]
    case 'spherical': {
      const r2 = x * x + y * y + 1e-9
      return [x / r2, y / r2]
    }
    case 'swirl': {
      const r2 = x * x + y * y
      const s = Math.sin(r2), c = Math.cos(r2)
      return [x * s - y * c, x * c + y * s]
    }
    case 'horseshoe': {
      const r = Math.sqrt(x * x + y * y) + 1e-9
      return [((x - y) * (x + y)) / r, (2 * x * y) / r]
    }
    case 'polar': {
      const theta = Math.atan2(y, x)
      const r = Math.sqrt(x * x + y * y)
      return [theta / Math.PI, r - 1]
    }
    case 'heart': {
      const r = Math.sqrt(x * x + y * y)
      const theta = Math.atan2(y, x)
      return [r * Math.sin(theta * r), -r * Math.cos(theta * r)]
    }
  }
}

export class FlameEngine extends BaseEngine {
  readonly id: EngineId = 'flame'
  protected readonly presets = PRESETS
  private x = 0
  private y = 0
  private hue = 0

  constructor(seed?: number) {
    super()
    this.randomize(seed)
  }

  randomize(seed?: number): void {
    super.randomize(seed)
    this.rng = new Rng(this.seed ^ 0xbeef)
    this.x = this.rng.range(-1, 1)
    this.y = this.rng.range(-1, 1)
    this.hue = 0.5
  }

  private currentFlame(): { transforms: Affine[] } {
    // Positive-safe modulo — see LSystemEngine for the same reasoning.
    const raw = this.internal.flameIndex
    const rawFloor = Number.isFinite(raw) ? Math.floor(raw) : 0
    const idx = ((rawFloor % FLAMES.length) + FLAMES.length) % FLAMES.length
    const base = FLAMES[idx]
    const transforms: Affine[] = base.transforms.map((t, ti) => ({
      a: this.internal[`t${ti}_a`] ?? t.a,
      b: this.internal[`t${ti}_b`] ?? t.b,
      c: this.internal[`t${ti}_c`] ?? t.c,
      d: this.internal[`t${ti}_d`] ?? t.d,
      e: this.internal[`t${ti}_e`] ?? t.e,
      f: this.internal[`t${ti}_f`] ?? t.f,
      prob: t.prob,
      hue: this.internal[`t${ti}_hue`] ?? t.hue,
      v: t.v,
    }))
    return { transforms }
  }

  sample(buffer: PointBuffer, ctx: EngineContext): number {
    const n = buffer.xs.length
    const { transforms } = this.currentFlame()
    let x = this.x, y = this.y, hue = this.hue
    // warm up
    for (let warm = 0; warm < 20; warm++) {
      const r = this.rng.next()
      let cum = 0
      let pick = transforms[transforms.length - 1]
      for (const t of transforms) {
        cum += t.prob
        if (r <= cum) { pick = t; break }
      }
      const ax = pick.a * x + pick.b * y + pick.c
      const ay = pick.d * x + pick.e * y + pick.f
      const [vx, vy] = applyVariation(pick.v, ax, ay)
      x = vx; y = vy
    }
    const baseHue = (ctx.params.flow * 0.4 + 0.0) % 1
    for (let i = 0; i < n; i++) {
      const r = this.rng.next()
      let cum = 0
      let pick = transforms[transforms.length - 1]
      for (const t of transforms) {
        cum += t.prob
        if (r <= cum) { pick = t; break }
      }
      const ax = pick.a * x + pick.b * y + pick.c
      const ay = pick.d * x + pick.e * y + pick.f
      let [vx, vy] = applyVariation(pick.v, ax, ay)
      // Variations like spherical / horseshoe can blow up near origin.
      // Gently reset if the state escapes the unit-ish disc.
      if (!isFinite(vx) || !isFinite(vy) || Math.abs(vx) > 50 || Math.abs(vy) > 50) {
        vx = this.rng.range(-0.5, 0.5)
        vy = this.rng.range(-0.5, 0.5)
      }
      x = vx; y = vy
      hue = (hue + pick.hue) * 0.5
      buffer.xs[i] = x * 0.7
      buffer.ys[i] = y * 0.7
      buffer.hues[i] = (baseHue + hue) % 1
      buffer.alphas[i] = 1
    }
    if (!isFinite(x) || !isFinite(y)) { x = 0; y = 0 }
    this.x = x; this.y = y; this.hue = hue
    buffer.count = n
    return n
  }
}
