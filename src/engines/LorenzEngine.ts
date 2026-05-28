import { BaseEngine, CuratedPreset } from './BaseEngine'
import type { EngineContext, EngineId, PointBuffer } from '../types'

// Lorenz attractor (projected to 2D via configurable rotation).
// Curated presets include the classic and several variants.
const PRESETS: CuratedPreset[] = [
  { internal: { sigma: 10, rho: 28, beta: 8 / 3, scale: 0.07, tilt: 0.6 } },
  { internal: { sigma: 14, rho: 32, beta: 2.6, scale: 0.06, tilt: 0.8 } },
  { internal: { sigma: 9, rho: 24, beta: 2.4, scale: 0.08, tilt: 0.4 } },
  { internal: { sigma: 11, rho: 30, beta: 2.8, scale: 0.065, tilt: 0.7 } },
  { internal: { sigma: 16, rho: 45, beta: 4.0, scale: 0.045, tilt: 1.0 } },
  { internal: { sigma: 10, rho: 99.96, beta: 8 / 3, scale: 0.03, tilt: 0.5 } },
]

export class LorenzEngine extends BaseEngine {
  readonly id: EngineId = 'lorenz'
  protected readonly presets = PRESETS
  private x = 0.01
  private y = 0
  private z = 0

  constructor(seed?: number) {
    super()
    this.randomize(seed)
    this.x = 0.01; this.y = 0; this.z = 0
  }

  sample(buffer: PointBuffer, ctx: EngineContext): number {
    const n = buffer.xs.length
    const { sigma, rho, beta, scale, tilt } = this.internal
    // dt scales with chaos / flow — gives the user a feel of velocity.
    const dt = 0.005 + 0.012 * ctx.params.flow
    const breath = 1 + 0.03 * ctx.motion.breath * Math.sin(ctx.time * 0.3)
    const rr = rho * breath
    let { x, y, z } = this
    const rotZ = ctx.time * 0.04 * ctx.motion.drift + ctx.params.orbit * Math.PI * 2
    const cs = Math.cos(rotZ), sn = Math.sin(rotZ)
    const t = tilt
    const baseHue = (ctx.params.flow * 0.4 + 0.55) % 1
    for (let i = 0; i < n; i++) {
      const dx = sigma * (y - x)
      const dy = x * (rr - z) - y
      const dz = x * y - beta * z
      x += dx * dt
      y += dy * dt
      z += dz * dt
      // Project (x, y, z) — rotate around Z, then tilt onto XY plane.
      const rx = x * cs - y * sn
      const ry = x * sn + y * cs
      const px = rx * scale
      const py = (ry * (1 - t) + (z - 25) * t) * scale
      buffer.xs[i] = px
      buffer.ys[i] = py
      const hue = (baseHue + z * 0.005) % 1
      buffer.hues[i] = (hue + 1) % 1
      buffer.alphas[i] = 1
    }
    this.x = x; this.y = y; this.z = z
    buffer.count = n
    return n
  }
}
