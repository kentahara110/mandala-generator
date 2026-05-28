import { BaseEngine, CuratedPreset } from './BaseEngine'
import type { EngineContext, EngineId, PointBuffer } from '../types'
import { fbm2D } from '../utils/math'

// Clifford attractor: x' = sin(a*y) + c*cos(a*x), y' = sin(b*x) + d*cos(b*y)
// Curated list = parameter sets that yield well-known beautiful attractors.
const PRESETS: CuratedPreset[] = [
  { internal: { a: -1.4, b: 1.6, c: 1.0, d: 0.7 } },
  { internal: { a: -1.7, b: 1.3, c: -0.1, d: -1.21 } },
  { internal: { a: 1.5, b: -1.8, c: 1.6, d: 0.9 } },
  { internal: { a: -1.8, b: -2.0, c: -0.5, d: -0.9 } },
  { internal: { a: 1.7, b: 1.7, c: 0.6, d: 1.2 } },
  { internal: { a: -1.24, b: -1.25, c: -1.81, d: -1.91 } },
  { internal: { a: 2.0, b: -1.7, c: 1.3, d: -1.4 } },
  { internal: { a: -2.0, b: 2.0, c: 1.0, d: -1.5 } },
  { internal: { a: -1.32, b: -1.65, c: 0.74, d: 1.81 } },
  { internal: { a: 1.6, b: -0.6, c: -1.2, d: 1.6 } },
]

export class CliffordEngine extends BaseEngine {
  readonly id: EngineId = 'clifford'
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
    // breath modulation makes the attractor gently breathe.
    const breath = 1 + 0.04 * ctx.motion.breath * Math.sin(ctx.time * 0.4)
    const aa = a * breath
    const bb = b * breath
    const organic = ctx.params.organic
    const tnoise = ctx.time * 0.07

    let x = this.x
    let y = this.y
    // Discard a few warm-up iterations once in a while to stay on attractor.
    for (let warm = 0; warm < 50; warm++) {
      const nx = Math.sin(aa * y) + c * Math.cos(aa * x)
      const ny = Math.sin(bb * x) + d * Math.cos(bb * y)
      x = nx; y = ny
    }
    const baseHue = (ctx.params.flow * 0.6 + 0.1) % 1
    const ds = 0.55 // display scale — keeps the attractor inside a comfortable disc
    for (let i = 0; i < n; i++) {
      const nx = Math.sin(aa * y) + c * Math.cos(aa * x)
      const ny = Math.sin(bb * x) + d * Math.cos(bb * y)
      x = nx; y = ny
      // gentle organic warp
      let px = x
      let py = y
      if (organic > 0.01) {
        const wn = fbm2D(x * 0.5 + tnoise, y * 0.5 - tnoise, 2) - 0.5
        px += wn * organic * 0.4
        py += wn * organic * 0.4
      }
      buffer.xs[i] = px * ds
      buffer.ys[i] = py * ds
      // hue varies with radius — gives a cosmic gradient feel.
      const r = Math.sqrt(px * px + py * py) * 0.25
      buffer.hues[i] = (baseHue + r + ctx.params.bloom * 0.1) % 1
      buffer.alphas[i] = 1
    }
    this.x = x
    this.y = y
    buffer.count = n
    return n
  }
}
