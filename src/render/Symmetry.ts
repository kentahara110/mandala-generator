import type { SharedStructure } from '../types'
import { TAU } from '../utils/math'

// The symmetry layer takes the engine's [-1,1] point cloud and folds it
// into a mandala via rotational copies and optional mirror reflection.
// We pre-compute trig tables for each frame so the inner loop is tight.

export interface SymmetryPlan {
  copies: Float64Array  // pairs of [cos, sin] per rotational copy
  mirror: number        // 0..1 — strength of mirror reflection
  spiral: number        // per-copy radial twist
  petals: number        // for kaleidoscope fold
}

export function buildPlan(s: SharedStructure, time: number): SymmetryPlan {
  // symmetry controls number of full rotational duplications (1..12).
  const symmetryCount = Math.max(1, Math.round(s.symmetry))
  const copies = new Float64Array(symmetryCount * 2)
  const drift = time * 0.02 // slow rotational drift
  for (let i = 0; i < symmetryCount; i++) {
    const a = (i / symmetryCount) * TAU + drift
    copies[i * 2] = Math.cos(a)
    copies[i * 2 + 1] = Math.sin(a)
  }
  return {
    copies,
    mirror: s.mirror,
    spiral: s.spiral,
    petals: Math.max(2, Math.round(s.petals)),
  }
}
