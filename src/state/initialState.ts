import type { AppState } from '../types'

export function makeInitialState(): AppState {
  return {
    engine: 'clifford',
    seed: (Math.random() * 0xffffffff) >>> 0,
    structure: {
      symmetry: 6,
      mirror: 0.4,
      petals: 6,
      spiral: 0.05,
      density: 0.7,
    },
    motion: {
      breath: 0.5,
      drift: 0.4,
      turbulence: 0.2,
      morphSpeed: 0.3,
    },
    rendering: {
      glow: 0.55,
      fade: 0.55,
      thickness: 1.2,
      bloom: 0.4,
      saturation: 1.0,
      zoom: 1.0,
    },
    color: {
      palette: 'cosmic',
      hueShift: 0,
      cosmic: 0.3,
      cycleSpeed: 0,
    },
    params: {
      chaos: 0.5,
      flow: 0.5,
      orbit: 0.5,
      organic: 0.25,
      warp: 0.4,
      resonance: 0.5,
      branching: 0.5,
      bloom: 0.5,
    },
    locks: {
      color: false,
      structure: false,
      motion: false,
      symmetry: false,
      rendering: false,
    },
  }
}
