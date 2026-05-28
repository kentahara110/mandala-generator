import { BaseEngine, CuratedPreset } from './BaseEngine'
import type { EngineContext, EngineId, PointBuffer } from '../types'
import { fbm2D, TAU } from '../utils/math'
import { Rng } from '../utils/random'

// Polar Flow Noise — a swarm of agents advected by a polar curl field
// shaped by fbm noise. Produces silky, organic, jellyfish-like trails.
const PRESETS: CuratedPreset[] = [
  { internal: { noiseScale: 1.2, swirl: 1.4, radial: 0.3, ringFreq: 5, speed: 0.7 } },
  { internal: { noiseScale: 0.7, swirl: 2.0, radial: 0.15, ringFreq: 8, speed: 0.5 } },
  { internal: { noiseScale: 1.8, swirl: 0.9, radial: 0.4, ringFreq: 3, speed: 1.0 } },
  { internal: { noiseScale: 1.0, swirl: 1.6, radial: 0.25, ringFreq: 6, speed: 0.8 } },
  { internal: { noiseScale: 0.5, swirl: 2.4, radial: 0.1, ringFreq: 12, speed: 0.45 } },
  { internal: { noiseScale: 2.2, swirl: 1.2, radial: 0.35, ringFreq: 4, speed: 0.9 } },
]

const AGENT_COUNT = 1400

export class FlowEngine extends BaseEngine {
  readonly id: EngineId = 'flow'
  protected readonly presets = PRESETS
  private ax = new Float32Array(AGENT_COUNT)
  private ay = new Float32Array(AGENT_COUNT)
  private ah = new Float32Array(AGENT_COUNT)
  private respawnTimer = 0

  constructor(seed?: number) {
    super()
    this.randomize(seed)
    this.respawnAll()
  }

  randomize(seed?: number): void {
    super.randomize(seed)
    this.respawnAll()
  }

  private respawnAll(): void {
    const rng = new Rng(this.seed ^ 0xa1)
    for (let i = 0; i < AGENT_COUNT; i++) {
      const r = Math.sqrt(rng.next()) * 1.6
      const a = rng.next() * TAU
      this.ax[i] = Math.cos(a) * r
      this.ay[i] = Math.sin(a) * r
      this.ah[i] = rng.next()
    }
  }

  sample(buffer: PointBuffer, ctx: EngineContext): number {
    const n = buffer.xs.length
    const { noiseScale, swirl, radial, ringFreq, speed } = this.internal
    const baseHue = (ctx.params.flow * 0.4 + 0.7) % 1
    const tn = ctx.time * 0.05 * speed
    const drift = ctx.motion.drift * 0.2
    let write = 0
    // Periodically respawn a few agents so the field keeps evolving.
    this.respawnTimer += 1
    if (this.respawnTimer > 30) {
      this.respawnTimer = 0
      const rng = new Rng(((Math.random() * 0xffffffff) | 0) >>> 0)
      for (let r = 0; r < 60; r++) {
        const idx = (rng.next() * AGENT_COUNT) | 0
        const rr = Math.sqrt(rng.next()) * 1.6
        const aa = rng.next() * TAU
        this.ax[idx] = Math.cos(aa) * rr
        this.ay[idx] = Math.sin(aa) * rr
        this.ah[idx] = rng.next()
      }
    }
    for (let i = 0; i < n && i < AGENT_COUNT; i++) {
      let x = this.ax[i]
      let y = this.ay[i]
      const r = Math.sqrt(x * x + y * y) + 1e-5
      const theta = Math.atan2(y, x)
      const fn =
        fbm2D(x * noiseScale + tn, y * noiseScale - tn, 3) - 0.5
      // Tangential swirl + radial breathing.
      const angle = theta + Math.PI / 2 + fn * 2.5 + drift
      const radialPulse = Math.sin(r * ringFreq - tn * 4) * radial
      const vx = Math.cos(angle) * swirl * 0.02 + Math.cos(theta) * radialPulse * 0.01
      const vy = Math.sin(angle) * swirl * 0.02 + Math.sin(theta) * radialPulse * 0.01
      x += vx
      y += vy
      if (r > 1.8) {
        // gentle wrap back to inner ring
        x *= 0.4
        y *= 0.4
      }
      this.ax[i] = x
      this.ay[i] = y
      buffer.xs[i] = x
      buffer.ys[i] = y
      buffer.hues[i] = (baseHue + this.ah[i] * 0.3 + r * 0.1) % 1
      buffer.alphas[i] = 1
      write++
    }
    buffer.count = write
    return write
  }
}
