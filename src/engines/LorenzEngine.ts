import { BaseEngine, CuratedPreset } from './BaseEngine'
import type { EngineContext, EngineId, PointBuffer } from '../types'

// Lorenz attractor (projected to 2D via configurable rotation).
// Curated presets include the classic and several variants.
const PRESETS: CuratedPreset[] = [
  { internal: { sigma: 10, rho: 28, beta: 8 / 3, scale: 0.07, tilt: 0.6 } },
  { internal: { sigma: 14, rho: 32, beta: 2.6, scale: 0.06, tilt: 0.8 } },
  { internal: { sigma: 9, rho: 24, beta: 2.4, scale: 0.08, tilt: 0.4 } },
  { internal: { sigma: 11, rho: 30, beta: 2.8, scale: 0.065, tilt: 0.7 } },
  { internal: { sigma: 13, rho: 35, beta: 3.0, scale: 0.055, tilt: 0.9 } },
  { internal: { sigma: 16, rho: 45, beta: 4.0, scale: 0.045, tilt: 1.0 } },
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
    // dt scales with chaos / flow — but is clamped down for stiff regimes
    // (large rho or sigma) so the explicit Euler step stays stable.
    const stiffness = Math.max(1, Math.abs(rho) / 30, Math.abs(sigma) / 12)
    const dt = (0.004 + 0.01 * ctx.params.flow) / stiffness
    const breath = 1 + 0.03 * ctx.motion.breath * Math.sin(ctx.time * 0.3)
    const rr = rho * breath
    let { x, y, z } = this
    const rotZ = ctx.time * 0.04 * ctx.motion.drift + ctx.params.orbit * Math.PI * 2
    const cs = Math.cos(rotZ), sn = Math.sin(rotZ)
    const t = tilt
    const baseHue = (ctx.params.flow * 0.4 + 0.55) % 1
    const ds = 0.6
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
      buffer.xs[i] = px * ds
      buffer.ys[i] = py * ds
      const hue = (baseHue + z * 0.005) % 1
      buffer.hues[i] = (hue + 1) % 1
      buffer.alphas[i] = 1
    }
    // Belt-and-braces: if the integrator ever drifts to NaN/Inf, reset.
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
      x = 0.01; y = 0; z = 0
    }
    this.x = x; this.y = y; this.z = z
    buffer.count = n
    return n
  }
}
