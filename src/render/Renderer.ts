import type {
  AppState,
  EngineContext,
  PointBuffer,
} from '../types'
import type { GeneratorEngine } from '../types'
import { buildPlan } from './Symmetry'
import {
  paletteFloor,
  paletteGlowGamma,
  samplePalette,
} from './Palettes'

// Accumulative renderer.
//
// Each frame:
// 1. fade the canvas (alpha rectangle) so old paint persists as trails.
// 2. for each batch of engine points, fold through the symmetry plan
//    and write into an additive HDR accumulation buffer (Float32Array).
// 3. Periodically tonemap the HDR buffer into the visible canvas with
//    a soft bloom-like response curve.

const SAMPLES_PER_FRAME = 6000

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private hdr: Float32Array  // RGB triples in linear space
  private width: number
  private height: number
  private buffer: PointBuffer
  private accumulationAge = 0
  // Reused ImageData — avoids reallocating a Uint8ClampedArray of canvas
  // size every frame (the put/get round-trip is a major Chrome bottleneck).
  private imageData: ImageData

  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d', { willReadFrequently: false, alpha: false })
    if (!c) throw new Error('No 2D context')
    this.ctx = c
    this.width = canvas.width
    this.height = canvas.height
    this.hdr = new Float32Array(this.width * this.height * 3)
    this.imageData = this.ctx.createImageData(this.width, this.height)
    this.buffer = {
      xs: new Float32Array(SAMPLES_PER_FRAME),
      ys: new Float32Array(SAMPLES_PER_FRAME),
      hues: new Float32Array(SAMPLES_PER_FRAME),
      alphas: new Float32Array(SAMPLES_PER_FRAME),
      count: 0,
    }
    this.clear()
  }

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this.width = width
    this.height = height
    this.hdr = new Float32Array(width * height * 3)
    this.imageData = this.ctx.createImageData(width, height)
    this.clear()
  }

  clear(): void {
    const c = this.ctx
    c.fillStyle = '#07060c'
    c.fillRect(0, 0, this.width, this.height)
    this.hdr.fill(0)
    this.accumulationAge = 0
  }

  // Sanitize an HDR buffer: replace any NaN/Inf cells with zero so a single
  // bad frame can't corrupt the canvas forever.
  private sanitizeHdr(): void {
    const hdr = this.hdr
    for (let i = 0; i < hdr.length; i++) {
      const v = hdr[i]
      if (!isFinite(v) || v < 0) hdr[i] = 0
    }
  }

  // Step + draw one frame.
  step(engine: GeneratorEngine, state: AppState, time: number): void {
    const w = this.width
    const h = this.height
    const ctxInfo: EngineContext = {
      time,
      width: w,
      height: h,
      params: state.params,
      motion: state.motion,
    }
    const count = engine.sample(this.buffer, ctxInfo)
    const plan = buildPlan(state.structure, time)
    const hdr = this.hdr
    // Soft alpha fade of HDR buffer = trail persistence.
    const fade = Math.max(0, Math.min(1, state.rendering.fade))
    // higher fade slider == longer trails => slower decay.
    const decay = Math.pow(0.985, 1 + (1 - fade) * 4)
    for (let i = 0; i < hdr.length; i++) hdr[i] *= decay

    const zoom = state.rendering.zoom ?? 1
    const scale = Math.min(w, h) * 0.42 * zoom
    const cx = w / 2
    const cy = h / 2
    const xs = this.buffer.xs
    const ys = this.buffer.ys
    const hues = this.buffer.hues
    const alphas = this.buffer.alphas
    const copies = plan.copies
    const copyCount = copies.length / 2
    const mirror = plan.mirror
    const spiral = plan.spiral
    const petals = plan.petals
    const palette = state.color.palette
    // Apply automatic colour drift: cycleSpeed > 0 rotates hueShift over time
    // so the mandala slowly cycles through the palette without user input.
    const cycleSpeed = state.color.cycleSpeed ?? 0
    const hueShift = state.color.hueShift + (cycleSpeed > 0 ? time * cycleSpeed * 0.07 : 0)
    const saturation = state.rendering.saturation
    const thickness = Math.max(0.5, state.rendering.thickness)
    const glow = state.rendering.glow
    const cosmic = state.color.cosmic
    const densityCap = 0.2 + state.structure.density * 0.8

    // pre-resolve palette colors per point. Since palette is a colormap,
    // we only need to sample once per point regardless of symmetry copy.
    // Energy per splat is tiny so accumulation builds up gradually rather
    // than saturating immediately — that's where the glow comes from.
    // Per-frame "ink budget" is roughly constant — bright when few points,
    // dim when many. Keeps reaction-diffusion / fern engines from blowing out.
    const energyBudget = 12 * (0.4 + glow * 0.9)
    const intensityScale = energyBudget / Math.max(count, 200)
    const pr = new Float32Array(count)
    const pg = new Float32Array(count)
    const pb = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const sample = samplePalette(palette, hues[i] + cosmic * 0.05, hueShift, saturation)
      pr[i] = sample.r * intensityScale
      pg[i] = sample.g * intensityScale
      pb[i] = sample.b * intensityScale
    }

    // density gate skips a fraction of samples for less crowded plots.
    const stride = densityCap < 1
      ? Math.max(1, Math.floor(1 / densityCap))
      : 1

    // For each sample, splat into HDR through every symmetry copy.
    const kaleidoFold = petals > 2
    const foldAngle = Math.PI / petals
    for (let i = 0; i < count; i += stride) {
      let xRaw = xs[i]
      let yRaw = ys[i]
      // Kaleidoscope fold — reflect into a single wedge then duplicate.
      if (kaleidoFold) {
        const r = Math.sqrt(xRaw * xRaw + yRaw * yRaw)
        let theta = Math.atan2(yRaw, xRaw)
        theta = Math.abs(((theta + foldAngle) % (foldAngle * 2)) - foldAngle)
        xRaw = Math.cos(theta) * r
        yRaw = Math.sin(theta) * r
      }
      // spiral twist by radius
      if (spiral !== 0) {
        const r = Math.sqrt(xRaw * xRaw + yRaw * yRaw)
        const t = Math.atan2(yRaw, xRaw) + spiral * r
        xRaw = Math.cos(t) * r
        yRaw = Math.sin(t) * r
      }
      // Skip non-finite sample points so transient engine instability
      // (NaN/Inf) doesn't poison the HDR accumulation buffer.
      if (!isFinite(xRaw) || !isFinite(yRaw)) continue
      const a = alphas[i]
      const intensity = a
      const r = pr[i] * intensity
      const g = pg[i] * intensity
      const b = pb[i] * intensity
      for (let c = 0; c < copyCount; c++) {
        const cs = copies[c * 2]
        const sn = copies[c * 2 + 1]
        const rx = xRaw * cs - yRaw * sn
        const ry = xRaw * sn + yRaw * cs
        const px = cx + rx * scale
        const py = cy + ry * scale
        this.splat(px, py, r, g, b, thickness)
        if (mirror > 0.01) {
          // mirror reflection across X axis of the rotated copy.
          const my = cy - ry * scale
          this.splatScaled(px, my, r, g, b, thickness, mirror)
        }
      }
    }

    this.accumulationAge++
    // Tonemap every frame so user sees latest accumulation.
    this.tonemap(state)
  }

  // Add an HDR contribution at integer pixel coords. thickness controls
  // the kernel — 1 = single pixel, >1 = small gaussian-ish splat.
  private splat(x: number, y: number, r: number, g: number, b: number, thickness: number): void {
    const w = this.width, h = this.height
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const xi = x | 0
    const yi = y | 0
    const idx = (yi * w + xi) * 3
    this.hdr[idx] += r
    this.hdr[idx + 1] += g
    this.hdr[idx + 2] += b
    if (thickness > 1) {
      const radius = thickness | 0
      const rr = r * 0.35
      const gg = g * 0.35
      const bb = b * 0.35
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = yi + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue
          const xx = xi + dx
          if (xx < 0 || xx >= w) continue
          const d2 = dx * dx + dy * dy
          const falloff = 1 / (1 + d2)
          const i = (yy * w + xx) * 3
          this.hdr[i] += rr * falloff
          this.hdr[i + 1] += gg * falloff
          this.hdr[i + 2] += bb * falloff
        }
      }
    }
  }

  private splatScaled(x: number, y: number, r: number, g: number, b: number, thickness: number, scale: number): void {
    this.splat(x, y, r * scale, g * scale, b * scale, thickness)
  }

  // HDR → 8-bit with a soft tonemap. The bloom slider is folded in by
  // running a cheap blur pass first.
  private tonemap(state: AppState): void {
    const bloomStrength = state.rendering.bloom
    // Always sanitize the HDR itself first — otherwise a NaN that enters the
    // buffer (from a brief engine blow-up) survives every frame because the
    // bloom path reads from HDR before we get a chance to write 0 to it.
    const hdr = this.hdr
    for (let i = 0; i < hdr.length; i++) {
      const v = hdr[i]
      if (!isFinite(v) || v < 0) hdr[i] = 0
    }
    let src = hdr
    if (bloomStrength > 0.02) {
      src = this.softBlur(hdr, bloomStrength)
    }
    // Reuse the same Uint8ClampedArray — getImageData would copy the entire
    // canvas back from the GPU each frame, which is the dominant cost on
    // Chrome. We overwrite every pixel anyway so no read is needed.
    const data = this.imageData.data
    const gamma = paletteGlowGamma(state.color.palette)
    const floor = paletteFloor(state.color.palette) * 12
    const exposure = 0.7 + state.rendering.glow * 1.7
    const bleachStart = 1.2
    const bleachScale = 0.7 / 3.0 // bleachMax / bleachWidth
    const bleachMax = 0.7
    // Skip Math.pow when gamma is essentially 1 (monochrome palette).
    // For other palettes, approximate x^gamma with a couple of multiplies:
    //   x^0.85 ≈ x * (0.55 + 0.45 * sqrt(x))
    // This is within ~1.5% over [0,1] and several times faster than pow().
    const useGamma = Math.abs(gamma - 1) > 0.02
    for (let i = 0, p = 0; i < src.length; i += 3, p += 4) {
      const r = src[i]
      const g = src[i + 1]
      const b = src[i + 2]
      // Color-preserving Reinhard: map the brightest channel through the
      // curve, then scale the others proportionally — preserves palette hue.
      const peak = r > g ? (r > b ? r : b) : (g > b ? g : b)
      if (peak <= 1e-6) {
        data[p] = floor
        data[p + 1] = floor
        data[p + 2] = floor
        data[p + 3] = 255
        continue
      }
      const peakE = peak * exposure
      const peakMapped = peakE / (1 + peakE)
      const ratio = peakMapped / peak
      // Per-channel Reinhard amount — only matters above bleachStart.
      let bleach = 0
      if (peakE > bleachStart) {
        bleach = (peakE - bleachStart) * bleachScale
        if (bleach > bleachMax) bleach = bleachMax
      }
      let rr: number, gg: number, bb: number
      if (bleach === 0) {
        rr = r * ratio
        gg = g * ratio
        bb = b * ratio
      } else {
        const cpR = r * ratio, cpG = g * ratio, cpB = b * ratio
        const rE = r * exposure, gE = g * exposure, bE = b * exposure
        const pcR = rE / (1 + rE), pcG = gE / (1 + gE), pcB = bE / (1 + bE)
        const k = 1 - bleach
        rr = cpR * k + pcR * bleach
        gg = cpG * k + pcG * bleach
        bb = cpB * k + pcB * bleach
      }
      if (useGamma) {
        rr = rr * (0.55 + 0.45 * Math.sqrt(rr))
        gg = gg * (0.55 + 0.45 * Math.sqrt(gg))
        bb = bb * (0.55 + 0.45 * Math.sqrt(bb))
      }
      // Uint8ClampedArray clamps for us, so skip Math.min(255, ...).
      data[p] = rr * 255 + floor
      data[p + 1] = gg * 255 + floor
      data[p + 2] = bb * 255 + floor
      data[p + 3] = 255
    }
    this.ctx.putImageData(this.imageData, 0, 0)
  }

  // Very cheap separable blur, written to a scratch buffer we keep around.
  private bloomScratch?: Float32Array
  private bloomScratch2?: Float32Array
  private softBlur(src: Float32Array, strength: number): Float32Array {
    const w = this.width, h = this.height
    if (!this.bloomScratch || this.bloomScratch.length !== src.length) {
      this.bloomScratch = new Float32Array(src.length)
      this.bloomScratch2 = new Float32Array(src.length)
    }
    const scratch = this.bloomScratch
    const out = this.bloomScratch2!
    const radius = Math.max(1, Math.floor(strength * 4))
    // horizontal pass (3-tap repeated for cheap wider blur)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, count = 0
        for (let k = -radius; k <= radius; k += radius) {
          const xx = Math.max(0, Math.min(w - 1, x + k))
          const i = (y * w + xx) * 3
          r += src[i]
          g += src[i + 1]
          b += src[i + 2]
          count++
        }
        const o = (y * w + x) * 3
        scratch[o] = r / count
        scratch[o + 1] = g / count
        scratch[o + 2] = b / count
      }
    }
    // vertical pass, blended back with the original to keep some sharpness.
    const mix = strength
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let r = 0, g = 0, b = 0, count = 0
        for (let k = -radius; k <= radius; k += radius) {
          const yy = Math.max(0, Math.min(h - 1, y + k))
          const i = (yy * w + x) * 3
          r += scratch[i]
          g += scratch[i + 1]
          b += scratch[i + 2]
          count++
        }
        const o = (y * w + x) * 3
        const br = r / count, bg = g / count, bb = b / count
        out[o] = src[o] + br * mix
        out[o + 1] = src[o + 1] + bg * mix
        out[o + 2] = src[o + 2] + bb * mix
      }
    }
    return out
  }

  // Export current canvas as PNG dataURL.
  exportPng(): string {
    return this.canvas.toDataURL('image/png')
  }
}
