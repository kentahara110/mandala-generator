import type { PaletteId } from '../types'

// A palette is a continuous mapping from hue ∈ [0,1] to RGB triplet.
// Implemented as a small set of color stops with smooth interpolation
// and palette-specific saturation/lightness curves.

interface ColorStop {
  pos: number  // 0..1
  r: number; g: number; b: number
}

interface PaletteSpec {
  stops: ColorStop[]
  // multiplier on the lightness curve — gives palettes different vibes.
  glowGamma: number
  // baseline brightness when alpha is low.
  floor: number
}

const PALETTES: Record<PaletteId, PaletteSpec> = {
  cosmic: {
    stops: [
      { pos: 0.0, r: 30, g: 8, b: 80 },
      { pos: 0.25, r: 80, g: 30, b: 170 },
      { pos: 0.5, r: 200, g: 80, b: 220 },
      { pos: 0.75, r: 255, g: 180, b: 220 },
      { pos: 1.0, r: 90, g: 200, b: 255 },
    ],
    glowGamma: 0.85,
    floor: 0.03,
  },
  neon: {
    stops: [
      { pos: 0.0, r: 255, g: 50, b: 180 },
      { pos: 0.33, r: 80, g: 255, b: 240 },
      { pos: 0.66, r: 255, g: 240, b: 80 },
      { pos: 1.0, r: 255, g: 60, b: 180 },
    ],
    glowGamma: 0.7,
    floor: 0.04,
  },
  monochrome: {
    stops: [
      { pos: 0.0, r: 20, g: 20, b: 28 },
      { pos: 0.5, r: 150, g: 150, b: 168 },
      { pos: 1.0, r: 240, g: 240, b: 255 },
    ],
    glowGamma: 1.0,
    floor: 0.02,
  },
  gold: {
    stops: [
      { pos: 0.0, r: 40, g: 18, b: 6 },
      { pos: 0.4, r: 200, g: 110, b: 30 },
      { pos: 0.75, r: 255, g: 200, b: 90 },
      { pos: 1.0, r: 255, g: 240, b: 200 },
    ],
    glowGamma: 0.9,
    floor: 0.03,
  },
  ultraviolet: {
    stops: [
      { pos: 0.0, r: 20, g: 0, b: 60 },
      { pos: 0.35, r: 100, g: 40, b: 220 },
      { pos: 0.7, r: 200, g: 100, b: 255 },
      { pos: 1.0, r: 240, g: 200, b: 255 },
    ],
    glowGamma: 0.8,
    floor: 0.025,
  },
  bioluminescent: {
    stops: [
      { pos: 0.0, r: 0, g: 30, b: 50 },
      { pos: 0.35, r: 20, g: 180, b: 200 },
      { pos: 0.7, r: 120, g: 255, b: 200 },
      { pos: 1.0, r: 220, g: 255, b: 240 },
    ],
    glowGamma: 0.75,
    floor: 0.03,
  },
  ember: {
    stops: [
      { pos: 0.0, r: 30, g: 5, b: 0 },
      { pos: 0.35, r: 200, g: 50, b: 10 },
      { pos: 0.7, r: 255, g: 160, b: 40 },
      { pos: 1.0, r: 255, g: 240, b: 180 },
    ],
    glowGamma: 0.8,
    floor: 0.04,
  },
  deepsea: {
    stops: [
      { pos: 0.0, r: 0, g: 6, b: 30 },
      { pos: 0.4, r: 10, g: 60, b: 130 },
      { pos: 0.7, r: 60, g: 180, b: 220 },
      { pos: 1.0, r: 220, g: 240, b: 255 },
    ],
    glowGamma: 0.85,
    floor: 0.02,
  },
}

function lerpStops(stops: ColorStop[], t: number): [number, number, number] {
  if (t <= stops[0].pos) return [stops[0].r, stops[0].g, stops[0].b]
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].pos) {
      const a = stops[i - 1]
      const b = stops[i]
      const span = b.pos - a.pos || 1
      const u = (t - a.pos) / span
      return [a.r + (b.r - a.r) * u, a.g + (b.g - a.g) * u, a.b + (b.b - a.b) * u]
    }
  }
  const last = stops[stops.length - 1]
  return [last.r, last.g, last.b]
}

export interface PaletteSample {
  r: number; g: number; b: number
}

// Sample at hue in [0,1], with hue shift and saturation adjustment.
// Returns 0..255 values.
export function samplePalette(
  id: PaletteId,
  hue: number,
  hueShift: number,
  saturation: number,
): PaletteSample {
  const spec = PALETTES[id]
  let h = hue + hueShift
  h = h - Math.floor(h)
  const [r, g, b] = lerpStops(spec.stops, h)
  // saturation = 1: original; 0: grayscale
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  const s = Math.max(0, Math.min(1.6, saturation))
  return {
    r: luma + (r - luma) * s,
    g: luma + (g - luma) * s,
    b: luma + (b - luma) * s,
  }
}

export function paletteFloor(id: PaletteId): number {
  return PALETTES[id].floor
}

export function paletteGlowGamma(id: PaletteId): number {
  return PALETTES[id].glowGamma
}

export const PALETTE_IDS: readonly PaletteId[] = [
  'cosmic',
  'neon',
  'monochrome',
  'gold',
  'ultraviolet',
  'bioluminescent',
  'ember',
  'deepsea',
]
