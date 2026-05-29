// Core shared types for the Generative Mandala Laboratory.

export type EngineId =
  | 'clifford'
  | 'dejong'
  | 'lorenz'
  | 'flow'
  | 'reaction'
  | 'lsystem'
  | 'flame'

export type PaletteId =
  | 'cosmic'
  | 'neon'
  | 'monochrome'
  | 'gold'
  | 'ultraviolet'
  | 'bioluminescent'
  | 'ember'
  | 'deepsea'
  | 'aurora'
  | 'nebula'
  | 'sakura'
  | 'twilight'
  | 'moss'
  | 'copper'
  | 'mercury'
  | 'opal'

// Abstract user-facing parameters — these intentionally do NOT map 1:1
// to mathematical attractor coefficients. They modulate the underlying
// engines through the engine adapters.
export interface SharedStructure {
  symmetry: number   // radial symmetry duplication
  mirror: number     // 0..1 — mirror reflection strength
  petals: number     // 2..24 — petal count for kaleidoscope
  spiral: number     // -1..1 — spiral twist per ring
  density: number    // 0..1 — point accumulation density
}

export interface SharedMotion {
  breath: number      // slow modulation amplitude
  drift: number       // rotational drift speed
  turbulence: number  // noise perturbation
  morphSpeed: number  // parameter morph speed
}

export interface SharedRendering {
  glow: number        // glow intensity
  fade: number        // alpha fade per frame (trail persistence)
  thickness: number   // point/line thickness
  bloom: number       // bloom-like effect
  saturation: number  // color saturation
  zoom: number        // viewport zoom, 0.1..2.0 (1.0 = default)
}

export interface SharedColor {
  palette: PaletteId
  hueShift: number    // 0..1
  cosmic: number      // 0..1 — color modulation amplitude
  cycleSpeed: number  // 0..1 — automatic hue drift over time (0 = off)
}

// Engine-specific abstract parameters. Each engine reads only the keys
// it cares about. Stored together in a single record for simplicity.
export interface EngineParams {
  // Universal abstract knobs the engines all listen to.
  chaos: number    // attractor divergence
  flow: number     // trajectory smoothness
  orbit: number    // rotational bias
  organic: number  // organic noise perturbation

  // Engine specific abstract knobs (still abstract names).
  warp: number     // warping / fold
  resonance: number
  branching: number
  bloom: number
}

export interface LockState {
  color: boolean
  structure: boolean
  motion: boolean
  symmetry: boolean
  rendering: boolean
}

export interface AppState {
  engine: EngineId
  seed: number
  structure: SharedStructure
  motion: SharedMotion
  rendering: SharedRendering
  color: SharedColor
  params: EngineParams
  locks: LockState
}

// What an engine state snapshot looks like (for save/load / evolution).
export interface EngineSnapshot {
  engine: EngineId
  seed: number
  params: EngineParams
  // Engines may store internal coefficient sets keyed by string.
  internal: Record<string, number>
}

// Result of one engine sampling pass — a stream of points to be drawn.
// Engines fill a pre-allocated buffer to avoid GC pressure.
export interface PointBuffer {
  xs: Float32Array
  ys: Float32Array
  hues: Float32Array  // 0..1
  alphas: Float32Array // 0..1
  count: number
}

export interface EngineContext {
  time: number       // global seconds
  width: number
  height: number
  params: EngineParams
  motion: SharedMotion
}

export interface GeneratorEngine {
  readonly id: EngineId
  // Sample a batch of points into the buffer; returns count written.
  sample(buffer: PointBuffer, ctx: EngineContext): number
  // Randomize from curated parameter space, optionally seeded.
  randomize(seed?: number): void
  // Slight mutation that preserves the current beauty.
  mutate(amount: number): void
  // Smooth interpolation between this engine state and `target`.
  interpolate(target: EngineSnapshot, t: number): void
  // Snapshot for save/load.
  snapshot(): EngineSnapshot
  // Restore from snapshot.
  restore(snap: EngineSnapshot): void
}
