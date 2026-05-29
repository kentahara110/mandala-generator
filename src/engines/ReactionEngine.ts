import { BaseEngine, CuratedPreset } from './BaseEngine'
import type { EngineContext, EngineId, PointBuffer } from '../types'
import { TAU } from '../utils/math'

// Lightweight Gray-Scott reaction-diffusion on a small grid. Each frame
// we step a few iterations and emit points where V is above a threshold.
// This keeps the engine cheap and lets the symmetry layer fold the result
// into a mandala.
const GRID = 96
const PRESETS: CuratedPreset[] = [
  { internal: { F: 0.0367, k: 0.0649, Du: 0.16, Dv: 0.08, scale: 1.5 } }, // coral
  { internal: { F: 0.025, k: 0.06, Du: 0.16, Dv: 0.08, scale: 1.4 } },     // bubbles
  { internal: { F: 0.014, k: 0.054, Du: 0.16, Dv: 0.08, scale: 1.7 } },    // mitosis
  { internal: { F: 0.022, k: 0.051, Du: 0.16, Dv: 0.08, scale: 1.6 } },    // spirals
  { internal: { F: 0.018, k: 0.045, Du: 0.16, Dv: 0.08, scale: 1.5 } },    // worms
  { internal: { F: 0.039, k: 0.058, Du: 0.16, Dv: 0.08, scale: 1.5 } },    // pulsing
]

export class ReactionEngine extends BaseEngine {
  readonly id: EngineId = 'reaction'
  protected readonly presets = PRESETS
  private u: Float32Array
  private v: Float32Array
  private u2: Float32Array
  private v2: Float32Array

  constructor(seed?: number) {
    super()
    this.u = new Float32Array(GRID * GRID)
    this.v = new Float32Array(GRID * GRID)
    this.u2 = new Float32Array(GRID * GRID)
    this.v2 = new Float32Array(GRID * GRID)
    this.randomize(seed)
  }

  randomize(seed?: number): void {
    super.randomize(seed)
    // Clamp Gray-Scott parameters into stable ranges. The base randomize
    // applies ±~0.015 gaussian noise to every internal key; for tiny F or
    // for already-low k presets that noise can push the parameters into
    // unstable regimes that decay to nothing or blow up to NaN.
    const clamp = (v: number, lo: number, hi: number) =>
      Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : (lo + hi) / 2
    this.internal.F = clamp(this.internal.F, 0.012, 0.045)
    this.internal.k = clamp(this.internal.k, 0.042, 0.068)
    this.internal.Du = clamp(this.internal.Du, 0.13, 0.20)
    this.internal.Dv = clamp(this.internal.Dv, 0.05, 0.10)
    this.internal.scale = clamp(this.internal.scale, 1.2, 1.9)
    this.reseedGrid()
    // Pre-evolve so the pattern is already mature when the user lands on it.
    for (let i = 0; i < 600; i++) this.step()
    // If the pre-evolve produced a dead pattern (everything below threshold),
    // fall back to a known-good preset so the user never sees an empty canvas.
    let max = 0
    for (let i = 0; i < this.v.length; i++) {
      const vv = this.v[i]
      if (Number.isFinite(vv) && vv > max) max = vv
    }
    if (!Number.isFinite(max) || max < 0.1) {
      this.internal.F = 0.0367
      this.internal.k = 0.0649
      this.internal.Du = 0.16
      this.internal.Dv = 0.08
      this.reseedGrid()
      for (let i = 0; i < 600; i++) this.step()
    }
  }

  private reseedGrid(): void {
    for (let i = 0; i < this.u.length; i++) {
      this.u[i] = 1
      this.v[i] = 0
    }
    // Copy the same to swap buffers so boundary stays consistent after swap.
    this.u2.set(this.u)
    this.v2.set(this.v)
    // Seed a large central blob plus radial arms — Gray-Scott needs a
    // sizable seed to develop stable patterns.
    const cx = GRID / 2, cy = GRID / 2
    const arms = 6 + (this.seed % 5)
    const r = GRID * 0.18
    // central seed
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const x = ((cx + dx) | 0)
        const y = ((cy + dy) | 0)
        if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue
        const idx = y * GRID + x
        this.v[idx] = 0.5
        this.u[idx] = 0.5
      }
    }
    for (let a = 0; a < arms; a++) {
      const theta = (a / arms) * TAU
      const sx = cx + Math.cos(theta) * r
      const sy = cy + Math.sin(theta) * r
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = ((sx + dx) | 0)
          const y = ((sy + dy) | 0)
          if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue
          const idx = y * GRID + x
          this.v[idx] = 0.6
          this.u[idx] = 0.4
        }
      }
    }
  }

  private step(): void {
    const { F, k, Du, Dv } = this.internal
    const dt = 1
    const u = this.u, v = this.v
    const u2 = this.u2, v2 = this.v2
    for (let y = 1; y < GRID - 1; y++) {
      for (let x = 1; x < GRID - 1; x++) {
        const i = y * GRID + x
        const lu =
          u[i - 1] + u[i + 1] + u[i - GRID] + u[i + GRID] - 4 * u[i]
        const lv =
          v[i - 1] + v[i + 1] + v[i - GRID] + v[i + GRID] - 4 * v[i]
        const uv = u[i] * v[i] * v[i]
        u2[i] = u[i] + dt * (Du * lu - uv + F * (1 - u[i]))
        v2[i] = v[i] + dt * (Dv * lv + uv - (F + k) * v[i])
      }
    }
    // copy boundary cells unchanged so they aren't lost across swap
    for (let i = 0; i < GRID; i++) {
      u2[i] = u[i]
      v2[i] = v[i]
      const last = (GRID - 1) * GRID + i
      u2[last] = u[last]
      v2[last] = v[last]
      u2[i * GRID] = u[i * GRID]
      v2[i * GRID] = v[i * GRID]
      const right = i * GRID + (GRID - 1)
      u2[right] = u[right]
      v2[right] = v[right]
    }
    // swap
    this.u = u2
    this.v = v2
    this.u2 = u
    this.v2 = v
  }

  sample(buffer: PointBuffer, ctx: EngineContext): number {
    const { scale } = this.internal
    // Run a few sim steps per frame — scaled by flow.
    const steps = 3 + Math.floor(ctx.params.flow * 6)
    for (let s = 0; s < steps; s++) this.step()
    const n = buffer.xs.length
    const baseHue = (ctx.params.flow * 0.3 + 0.45) % 1
    let write = 0
    const threshold = 0.18 - ctx.params.chaos * 0.1
    const halfGrid = GRID / 2
    // Walk the grid; for each above-threshold cell emit a couple of
    // jittered points so the cloud feels organic rather than gridded.
    const v = this.v
    const ds = 0.55 // display scale — keep reaction pattern comfortably inside the disc
    for (let iy = 0; iy < GRID && write < n; iy++) {
      for (let ix = 0; ix < GRID && write < n; ix++) {
        const vv = v[iy * GRID + ix]
        if (vv < threshold) continue
        const emit = vv > 0.5 ? 2 : 1
        for (let e = 0; e < emit && write < n; e++) {
          const fx = ((ix - halfGrid) / halfGrid) * scale + (Math.random() - 0.5) * 0.02
          const fy = ((iy - halfGrid) / halfGrid) * scale + (Math.random() - 0.5) * 0.02
          buffer.xs[write] = fx * ds
          buffer.ys[write] = fy * ds
          buffer.hues[write] = (baseHue + vv * 0.4) % 1
          buffer.alphas[write] = Math.min(1, vv * 1.8)
          write++
        }
      }
    }
    buffer.count = write
    return write
  }
}
