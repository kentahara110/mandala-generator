// Lightweight value noise — good enough for organic perturbation
// without pulling in a perlin/simplex dependency.

const HASH = (x: number, y: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

export function valueNoise2D(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const v00 = HASH(xi, yi)
  const v10 = HASH(xi + 1, yi)
  const v01 = HASH(xi, yi + 1)
  const v11 = HASH(xi + 1, yi + 1)
  const u = smooth(xf)
  const v = smooth(yf)
  const a = v00 + (v10 - v00) * u
  const b = v01 + (v11 - v01) * u
  return a + (b - a) * v
}

export function fbm2D(x: number, y: number, octaves = 3): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * freq, y * freq) * amp
    freq *= 2
    amp *= 0.5
  }
  return sum
}

export const TAU = Math.PI * 2
