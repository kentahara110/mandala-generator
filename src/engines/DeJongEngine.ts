import { BaseEngine, CuratedPreset } from './BaseEngine'
import type { EngineContext, EngineId, PointBuffer } from '../types'
import { fbm2D } from '../utils/math'

// Peter de Jong attractor:
// x' = sin(a*y) - cos(b*x), y' = sin(c*x) - cos(d*y)
const PRESETS: CuratedPreset[] = [
  { internal: { a: 1.4, b: -2.3, c: 2.4, d: -2.1 } },
  { internal: { a: -2.7, b: -0.09, c: -0.86, d: -2.2 } },
  { internal: { a: -2.0, b: -2.0, c: -1.2, d: 2.0 } },
  { internal: { a: 1.641, b: 1.902, c: 0.316, d: 1.525 } },
  { internal: { a: 0.97, b: -1.899, c: 1.381, d: -1.506 } },
  { internal: { a: 1.4, b: 1.56, c: 1.4, d: -6.56 } },
  { internal: { a: -2.24, b: 0.43, c: -0.65, d: -2.43 } },
  { internal: { a: 2.01, b: -2.53, c: 1.61, d: -0.33 } },
  { internal: { a: -1.7, b: 1.8, c: -1.9, d: -0.4 } },
  { internal: { a: -1.844, b: -1.4, c: 1.34, d: -2.3 } },
]

export class DeJongEngine extends BaseEngine {
  readonly id: EngineId = 'dejong'
  protected readonly presets = PRESETS
  private x = 0.1
  private y = 0.0

  constructor(seed?: number) {
    super()
    this.randomize(seed)
  }

  sample(buffer: PointBuffer, ctx: EngineContext): number {
    const n = buffer.xs.length
    const { a, b, c, d } = this.internal
    const breath = 1 + 0.03 * ctx.motion.breath * Math.sin(ctx.time * 0.35 + 1)
    const aa = a * breath
    const dd = d * breath
    const organic = ctx.params.organic
    const tn = ctx.time * 0.05
    let x = this.x
    let y = this.y
    for (let warm = 0; warm < 50; warm++) {
      const nx = Math.sin(aa * y) - Math.cos(b * x)
      const ny = Math.sin(c * x) - Math.cos(dd * y)
      x = nx; y = ny
    }
    const baseHue = (ctx.params.flow * 0.5 + 0.55) % 1
    const ds = 0.55
    for (let i = 0; i < n; i++) {
      const nx = Math.sin(aa * y) - Math.cos(b * x)
      const ny = Math.sin(c * x) - Math.cos(dd * y)
      x = nx; y = ny
      let px = x
      let py = y
      if (organic > 0.01) {
        const wn = fbm2D(x * 0.4 + tn, y * 0.4 - tn, 2) - 0.5
        px += wn * organic * 0.35
        py += wn * organic * 0.35
      }
      buffer.xs[i] = px * ds
      buffer.ys[i] = py * ds
      const r = Math.sqrt(px * px + py * py) * 0.2
      buffer.hues[i] = (baseHue + r * 0.7) % 1
      buffer.alphas[i] = 1
    }
    this.x = x; this.y = y
    buffer.count = n
    return n
  }
}
