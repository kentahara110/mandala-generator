import { BaseEngine, CuratedPreset } from './BaseEngine'
import type { EngineContext, EngineId, PointBuffer } from '../types'
import { TAU } from '../utils/math'
import { Rng } from '../utils/random'

// L-System engine — interpreted continuously so the system grows and
// retreats over time. We pick from a few well-known plant/fractal grammars
// and emit branch sample points.
interface Rule {
  axiom: string
  rules: Record<string, string>
  angle: number
  iterations: number
}

const RULES: Rule[] = [
  // Sierpinski-like
  { axiom: 'F-G-G', rules: { F: 'F-G+F+G-F', G: 'GG' }, angle: 120, iterations: 5 },
  // Fern
  { axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, angle: 25, iterations: 5 },
  // Koch
  { axiom: 'F', rules: { F: 'F+F-F-F+F' }, angle: 90, iterations: 4 },
  // Plant
  { axiom: 'F', rules: { F: 'FF+[+F-F-F]-[-F+F+F]' }, angle: 22.5, iterations: 4 },
  // Dragon
  { axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, angle: 90, iterations: 10 },
]

const PRESETS: CuratedPreset[] = RULES.map((r, i) => ({
  internal: {
    ruleIndex: i,
    angle: r.angle,
    growth: 0.5,
    twist: 0,
    stepLen: 0.05,
  },
}))

export class LSystemEngine extends BaseEngine {
  readonly id: EngineId = 'lsystem'
  protected readonly presets = PRESETS
  private cached: number[][] = [] // cached point streams for each rule
  private cachedIndex = -1

  constructor(seed?: number) {
    super()
    this.randomize(seed)
  }

  private expandRule(rule: Rule): string {
    let s = rule.axiom
    for (let i = 0; i < rule.iterations; i++) {
      let out = ''
      for (let j = 0; j < s.length; j++) {
        const ch = s[j]
        out += rule.rules[ch] ?? ch
      }
      s = out
      if (s.length > 60000) break
    }
    return s
  }

  private buildCache(): number[] {
    // Positive-safe modulo — base randomize() perturbs every internal field
    // by ±~0.015, which can land ruleIndex at -0.01 → Math.floor → -1 →
    // RULES[-1] would be undefined and the engine would throw, leaving the
    // canvas stuck blank. Clamp into [0, RULES.length).
    const raw = this.internal.ruleIndex
    const rawFloor = Number.isFinite(raw) ? Math.floor(raw) : 0
    const idx = ((rawFloor % RULES.length) + RULES.length) % RULES.length
    if (this.cachedIndex === idx && this.cached[idx]) return this.cached[idx]
    const rule = RULES[idx]
    const expanded = this.expandRule(rule)
    const pts: number[] = []
    type Stack = { x: number; y: number; a: number }
    const stack: Stack[] = []
    let x = 0, y = 0, a = -Math.PI / 2
    const ang = (this.internal.angle * Math.PI) / 180
    const step = 1
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (let i = 0; i < expanded.length; i++) {
      const ch = expanded[i]
      if (ch === 'F' || ch === 'G') {
        const nx = x + Math.cos(a) * step
        const ny = y + Math.sin(a) * step
        // sample a couple points per segment for smooth lines
        const samples = 3
        for (let s = 1; s <= samples; s++) {
          const t = s / samples
          const px = x + (nx - x) * t
          const py = y + (ny - y) * t
          pts.push(px, py)
          if (px < minX) minX = px
          if (px > maxX) maxX = px
          if (py < minY) minY = py
          if (py > maxY) maxY = py
        }
        x = nx; y = ny
      } else if (ch === '+') {
        a += ang
      } else if (ch === '-') {
        a -= ang
      } else if (ch === '[') {
        stack.push({ x, y, a })
      } else if (ch === ']') {
        const s = stack.pop()
        if (s) { x = s.x; y = s.y; a = s.a }
      }
    }
    // Normalize into [-1, 1] box.
    const w = maxX - minX || 1
    const h = maxY - minY || 1
    const scale = 1.8 / Math.max(w, h)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    for (let i = 0; i < pts.length; i += 2) {
      pts[i] = (pts[i] - cx) * scale
      pts[i + 1] = (pts[i + 1] - cy) * scale
    }
    this.cached[idx] = pts
    this.cachedIndex = idx
    return pts
  }

  randomize(seed?: number): void {
    super.randomize(seed)
    this.cached = []
    this.cachedIndex = -1
  }

  sample(buffer: PointBuffer, ctx: EngineContext): number {
    const pts = this.buildCache()
    const n = buffer.xs.length
    const baseHue = (ctx.params.flow * 0.3 + 0.3) % 1
    // Growth phase: slowly reveal more of the curve.
    const t = ctx.time * 0.05 * ctx.motion.drift
    const grow = 0.6 + 0.4 * Math.sin(t)
    const maxPts = Math.min(Math.floor((pts.length / 2) * grow), pts.length / 2)
    const twist = this.internal.twist * 0.3 + ctx.params.orbit * 0.5
    const rng = new Rng(this.seed + Math.floor(t * 30))
    let write = 0
    for (let i = 0; i < n; i++) {
      const idx = (rng.next() * maxPts) | 0
      const x = pts[idx * 2]
      const y = pts[idx * 2 + 1]
      // gentle twist per radius
      const r = Math.sqrt(x * x + y * y)
      const baseA = Math.atan2(y, x) + twist * r
      const px = Math.cos(baseA) * r
      const py = Math.sin(baseA) * r
      buffer.xs[write] = px
      buffer.ys[write] = py
      buffer.hues[write] = (baseHue + r * 0.3) % 1
      buffer.alphas[write] = 1
      write++
    }
    buffer.count = write
    return write
  }
}
