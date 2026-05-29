import type {
  GeneratorEngine,
  EngineId,
  EngineParams,
  EngineContext,
  EngineSnapshot,
  PointBuffer,
} from '../types'
import { Rng, clamp, lerp } from '../utils/random'

export interface CuratedPreset {
  // Internal coefficient set in the engine's own parameter space.
  internal: Record<string, number>
  // Optional override of the abstract params — usually omitted so the
  // engine adopts the global abstract knobs.
  paramHint?: Partial<EngineParams>
}

// BaseEngine handles the common bookkeeping: snapshots, curated
// randomization, mutate-preserving-beauty, interpolation.
// Subclasses implement `sample()` and provide curated presets.
export abstract class BaseEngine implements GeneratorEngine {
  abstract readonly id: EngineId
  protected abstract readonly presets: readonly CuratedPreset[]
  protected internal: Record<string, number> = {}
  protected params: EngineParams = {
    chaos: 0.5,
    flow: 0.5,
    orbit: 0.5,
    organic: 0.3,
    warp: 0.4,
    resonance: 0.5,
    branching: 0.5,
    bloom: 0.5,
  }
  protected seed = Date.now() & 0xffffffff
  protected rng: Rng = new Rng(this.seed)

  abstract sample(buffer: PointBuffer, ctx: EngineContext): number

  // Pick a curated preset, then add tiny noise to never repeat exactly.
  randomize(seed?: number): void {
    if (seed !== undefined) this.seed = seed >>> 0
    else this.seed = (Math.random() * 0xffffffff) >>> 0
    this.rng = new Rng(this.seed)
    const preset = this.rng.pick(this.presets)
    this.internal = { ...preset.internal }
    // Subtle variation around the curated point.
    for (const k of Object.keys(this.internal)) {
      this.internal[k] += this.rng.normal(0, 0.015)
    }
    if (preset.paramHint) {
      for (const k of Object.keys(preset.paramHint) as (keyof EngineParams)[]) {
        const v = preset.paramHint[k]
        if (typeof v === 'number') this.params[k] = v
      }
    }
  }

  // Beauty-preserving mutation. We perturb internal coefficients with a
  // gaussian step, then very lightly re-anchor toward the *nearest* curated
  // preset so the result stays inside the curated manifold without
  // collapsing back to the same point. The step has been tuned so a
  // mutation is *visible* on a single click — earlier settings produced
  // changes too subtle for users to notice.
  mutate(amount: number): void {
    const a = clamp(amount, 0, 1)
    const step = a * 0.14
    for (const k of Object.keys(this.internal)) {
      this.internal[k] += this.rng.normal(0, step)
    }
    // Re-anchor toward nearest preset, but only weakly — enough to keep
    // wild divergence in check, not enough to undo the variation.
    const anchor = this.nearestPreset()
    if (anchor) {
      const pull = 0.05 * a
      for (const k of Object.keys(this.internal)) {
        const target = anchor.internal[k] ?? this.internal[k]
        this.internal[k] = lerp(this.internal[k], target, pull)
      }
    }
  }

  interpolate(target: EngineSnapshot, t: number): void {
    const tt = clamp(t, 0, 1)
    for (const k of Object.keys(this.internal)) {
      const tgt = target.internal[k]
      if (typeof tgt === 'number') {
        this.internal[k] = lerp(this.internal[k], tgt, tt)
      }
    }
    for (const k of Object.keys(this.params) as (keyof EngineParams)[]) {
      const tgt = target.params[k]
      if (typeof tgt === 'number') {
        this.params[k] = lerp(this.params[k], tgt, tt)
      }
    }
  }

  snapshot(): EngineSnapshot {
    return {
      engine: this.id,
      seed: this.seed,
      params: { ...this.params },
      internal: { ...this.internal },
    }
  }

  restore(snap: EngineSnapshot): void {
    this.seed = snap.seed
    this.rng = new Rng(this.seed)
    this.internal = { ...snap.internal }
    this.params = { ...this.params, ...snap.params }
  }

  setParams(p: Partial<EngineParams>): void {
    Object.assign(this.params, p)
  }

  getParams(): EngineParams {
    return this.params
  }

  protected nearestPreset(): CuratedPreset | null {
    if (this.presets.length === 0) return null
    let best: CuratedPreset | null = null
    let bestDist = Infinity
    for (const p of this.presets) {
      let d = 0
      for (const k of Object.keys(p.internal)) {
        const a = p.internal[k]
        const b = this.internal[k] ?? a
        d += (a - b) * (a - b)
      }
      if (d < bestDist) {
        bestDist = d
        best = p
      }
    }
    return best
  }
}
