import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppState,
  EngineId,
  EngineSnapshot,
  PaletteId,
} from './types'
import { makeInitialState } from './state/initialState'
import { createEngine, ENGINES } from './engines'
import type { GeneratorEngine } from './types'
import { Renderer } from './render/Renderer'
import { Slider } from './components/Slider'
import { EngineSelector } from './components/EngineSelector'
import { PaletteGrid } from './components/PaletteGrid'
import { LockToggle } from './components/LockToggle'
import { EvolutionPanel } from './components/EvolutionPanel'

interface Variant {
  snapshot: EngineSnapshot
  key: string
}

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const engineRef = useRef<GeneratorEngine | null>(null)
  const stateRef = useRef<AppState>(makeInitialState())
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(performance.now())

  // React state mirror — used for UI rendering. The animation loop reads
  // stateRef so we don't pay reconciliation cost per frame.
  const [, forceRender] = useState(0)
  const repaint = useCallback(() => forceRender((n) => n + 1), [])

  const [variants, setVariants] = useState<Variant[]>([])

  // Initialize engine + renderer.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const wrap = canvas.parentElement
    if (!wrap) return
    // Cap on-screen and internal resolution independently. We deliberately
    // ignore devicePixelRatio for the internal buffer: every frame walks the
    // HDR buffer multiple times (fade, splat, optional bloom, tonemap), and
    // a 2× DPR factor would make Chrome do ~4× the per-frame work for a
    // glowing diffuse pattern where the extra sharpness is barely visible.
    const MAX_DISPLAY = 760
    const MIN_DISPLAY = 360
    const MAX_INTERNAL = 820
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const display = Math.max(
        MIN_DISPLAY,
        Math.min(MAX_DISPLAY, Math.floor(Math.min(rect.width, rect.height) * 0.92)),
      )
      const internal = Math.min(MAX_INTERNAL, display)
      canvas.style.width = `${display}px`
      canvas.style.height = `${display}px`
      if (!rendererRef.current) {
        canvas.width = internal
        canvas.height = internal
        rendererRef.current = new Renderer(canvas)
      } else {
        rendererRef.current.resize(internal, internal)
      }
    }
    resize()
    engineRef.current = createEngine(stateRef.current.engine, stateRef.current.seed)
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // Animation loop — drives the renderer.
  // We cap the render rate at ~33 FPS (30ms). The mandala is meditative so
  // higher frame rates add no perceptible benefit but cost a lot — especially
  // in Chrome where the canvas is rendered at full devicePixelRatio. This
  // also leaves headroom for the bloom + tonemap passes on slower machines.
  useEffect(() => {
    const FRAME_MS = 30
    let lastRender = 0
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick)
      if (now - lastRender < FRAME_MS) return
      lastRender = now
      const t = (now - startTimeRef.current) / 1000
      const renderer = rendererRef.current
      const engine = engineRef.current
      if (renderer && engine) {
        renderer.step(engine, stateRef.current, t)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Helpers to merge into state and repaint UI.
  const update = useCallback(
    (mut: (s: AppState) => void) => {
      const s = stateRef.current
      mut(s)
      // sync engine-specific params to engine instance
      const engine = engineRef.current as unknown as { setParams?: (p: any) => void }
      if (engine && typeof engine.setParams === 'function') {
        engine.setParams(s.params)
      }
      repaint()
    },
    [repaint],
  )

  const switchEngine = useCallback(
    (id: EngineId) => {
      stateRef.current.engine = id
      engineRef.current = createEngine(id, stateRef.current.seed)
      ;(engineRef.current as unknown as { setParams?: (p: any) => void }).setParams?.(
        stateRef.current.params,
      )
      rendererRef.current?.clear()
      repaint()
    },
    [repaint],
  )

  // Curated randomize — respects locks.
  const randomize = useCallback(() => {
    const s = stateRef.current
    const newSeed = (Math.random() * 0xffffffff) >>> 0
    s.seed = newSeed
    const engine = createEngine(s.engine, newSeed)
    engineRef.current = engine

    if (!s.locks.color) {
      const palettes: PaletteId[] = [
        'cosmic', 'neon', 'monochrome', 'gold',
        'ultraviolet', 'bioluminescent', 'ember', 'deepsea',
      ]
      s.color.palette = palettes[Math.floor(Math.random() * palettes.length)]
      s.color.hueShift = Math.random()
      s.color.cosmic = 0.2 + Math.random() * 0.4
    }
    if (!s.locks.structure) {
      s.structure.density = 0.4 + Math.random() * 0.5
    }
    if (!s.locks.symmetry) {
      s.structure.symmetry = 1 + Math.floor(Math.random() * 8)
      s.structure.mirror = Math.random() < 0.5 ? 0 : Math.random() * 0.8
      s.structure.petals = 2 + Math.floor(Math.random() * 10)
      s.structure.spiral = (Math.random() - 0.5) * 0.4
    }
    if (!s.locks.motion) {
      s.motion.drift = 0.2 + Math.random() * 0.6
      s.motion.breath = 0.3 + Math.random() * 0.6
      s.motion.turbulence = Math.random() * 0.4
      s.motion.morphSpeed = 0.2 + Math.random() * 0.4
    }
    if (!s.locks.rendering) {
      s.rendering.glow = 0.4 + Math.random() * 0.4
      s.rendering.fade = 0.35 + Math.random() * 0.5
      s.rendering.bloom = 0.2 + Math.random() * 0.6
      s.rendering.thickness = 1 + Math.random() * 1.5
      s.rendering.saturation = 0.7 + Math.random() * 0.6
    }
    s.params.flow = 0.3 + Math.random() * 0.5
    s.params.chaos = 0.3 + Math.random() * 0.5
    s.params.orbit = Math.random()
    s.params.organic = 0.1 + Math.random() * 0.4
    ;(engine as unknown as { setParams?: (p: any) => void }).setParams?.(s.params)
    rendererRef.current?.clear()
    repaint()
  }, [repaint])

  // Slight mutation — preserve everything, only nudge engine internals.
  const mutateSlightly = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.mutate(0.3)
    rendererRef.current?.clear()
  }, [])

  // Generate four candidate variants from current state.
  const spawnVariants = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const base = engine.snapshot()
    const out: Variant[] = []
    for (let i = 0; i < 4; i++) {
      const child = createEngine(base.engine, base.seed ^ (1 << (i * 5 + 3)))
      child.restore(base)
      child.mutate(0.25 + i * 0.12)
      out.push({ snapshot: child.snapshot(), key: `v${Date.now()}-${i}` })
    }
    setVariants(out)
  }, [])

  const pickVariant = useCallback(
    (snap: EngineSnapshot) => {
      engineRef.current?.restore(snap)
      rendererRef.current?.clear()
      setVariants([])
    },
    [],
  )

  const exportPng = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    const url = renderer.exportPng()
    const a = document.createElement('a')
    a.href = url
    a.download = `mandala-${Date.now()}.png`
    a.click()
  }, [])

  const exportPreset = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const data = {
      version: 1,
      state: stateRef.current,
      engine: engine.snapshot(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mandala-preset-${Date.now()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  const importPreset = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return
      try {
        const text = await f.text()
        const data = JSON.parse(text)
        if (!data || !data.state || !data.engine) return
        const s = stateRef.current
        Object.assign(s, data.state)
        const engine = createEngine(data.engine.engine, data.engine.seed)
        engine.restore(data.engine)
        engineRef.current = engine
        rendererRef.current?.clear()
        repaint()
      } catch (e) {
        console.error('Failed to load preset', e)
      }
    }
    input.click()
  }, [repaint])

  const s = stateRef.current
  const baseState = useMemo(() => stateRef.current, [variants.length])

  return (
    <div className="app">
      {/* LEFT PANEL — engines + structure + motion */}
      <div className="panel">
        <div className="section">
          <div className="subtitle">Engine</div>
          <EngineSelector active={s.engine} onSelect={switchEngine} />
          <div className="help-text">
            Each engine is a different way of dreaming.
          </div>
        </div>

        <div className="section">
          <div className="subtitle">
            <span>Structure</span>
            <LockToggle
              locked={s.locks.structure}
              onToggle={() => update((s) => { s.locks.structure = !s.locks.structure })}
            />
          </div>
          <Slider label="Symmetry" value={s.structure.symmetry} min={1} max={12} step={1}
            onChange={(v) => update((s) => { s.structure.symmetry = v })} />
          <Slider label="Mirror" value={s.structure.mirror} min={0} max={1}
            onChange={(v) => update((s) => { s.structure.mirror = v })} />
          <Slider label="Petals" value={s.structure.petals} min={2} max={16} step={1}
            onChange={(v) => update((s) => { s.structure.petals = v })} />
          <Slider label="Spiral" value={s.structure.spiral} min={-0.5} max={0.5}
            onChange={(v) => update((s) => { s.structure.spiral = v })} />
          <Slider label="Density" value={s.structure.density} min={0.05} max={1}
            onChange={(v) => update((s) => { s.structure.density = v })} />
        </div>

        <div className="section">
          <div className="subtitle">
            <span>Motion</span>
            <LockToggle
              locked={s.locks.motion}
              onToggle={() => update((s) => { s.locks.motion = !s.locks.motion })}
            />
          </div>
          <Slider label="Breath" value={s.motion.breath} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.breath = v })} />
          <Slider label="Drift" value={s.motion.drift} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.drift = v })} />
          <Slider label="Turbulence" value={s.motion.turbulence} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.turbulence = v })} />
          <Slider label="Morph Speed" value={s.motion.morphSpeed} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.morphSpeed = v })} />
        </div>

        <div className="section">
          <div className="subtitle">
            <span>Engine Voice</span>
          </div>
          <Slider label="Chaos" value={s.params.chaos} min={0} max={1}
            onChange={(v) => update((s) => { s.params.chaos = v })} />
          <Slider label="Flow" value={s.params.flow} min={0} max={1}
            onChange={(v) => update((s) => { s.params.flow = v })} />
          <Slider label="Orbit" value={s.params.orbit} min={0} max={1}
            onChange={(v) => update((s) => { s.params.orbit = v })} />
          <Slider label="Organic" value={s.params.organic} min={0} max={1}
            onChange={(v) => update((s) => { s.params.organic = v })} />
        </div>
      </div>

      {/* CENTER — canvas */}
      <div className="canvas-wrap">
        <div className="brand">
          Generative Mandala Laboratory
          <span className="dim">
            {ENGINES.find((e) => e.id === s.engine)?.label} · seed {s.seed.toString(16).padStart(8, '0')}
          </span>
        </div>
        <canvas ref={canvasRef} className="mandala" />
      </div>

      {/* RIGHT PANEL — rendering, color, actions */}
      <div className="panel right">
        <div className="section">
          <div className="subtitle">
            <span>Rendering</span>
            <LockToggle
              locked={s.locks.rendering}
              onToggle={() => update((s) => { s.locks.rendering = !s.locks.rendering })}
            />
          </div>
          <Slider label="Zoom" value={s.rendering.zoom} min={0.1} max={2} step={0.05}
            display={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => update((s) => { s.rendering.zoom = v })} />
          <Slider label="Glow" value={s.rendering.glow} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.glow = v })} />
          <Slider label="Fade" value={s.rendering.fade} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.fade = v })} />
          <Slider label="Thickness" value={s.rendering.thickness} min={0.5} max={3} step={0.1}
            onChange={(v) => update((s) => { s.rendering.thickness = v })} />
          <Slider label="Bloom" value={s.rendering.bloom} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.bloom = v })} />
          <Slider label="Saturation" value={s.rendering.saturation} min={0} max={1.6}
            onChange={(v) => update((s) => { s.rendering.saturation = v })} />
        </div>

        <div className="section">
          <div className="subtitle">
            <span>Color</span>
            <LockToggle
              locked={s.locks.color}
              onToggle={() => update((s) => { s.locks.color = !s.locks.color })}
            />
          </div>
          <PaletteGrid
            active={s.color.palette}
            onSelect={(p) => update((s) => { s.color.palette = p })}
          />
          <Slider label="Hue Shift" value={s.color.hueShift} min={0} max={1}
            onChange={(v) => update((s) => { s.color.hueShift = v })} />
          <Slider label="Cosmic" value={s.color.cosmic} min={0} max={1}
            onChange={(v) => update((s) => { s.color.cosmic = v })} />
        </div>

        <div className="section">
          <div className="subtitle">Discover</div>
          <button className="btn primary full" onClick={mutateSlightly}>
            ✦ Mutate Slightly
          </button>
          <div style={{ height: 6 }} />
          <button className="btn full" onClick={randomize}>
            Surprise Me
          </button>
          <div style={{ height: 6 }} />
          <button className="btn full" onClick={spawnVariants}>
            Spawn Four Variants
          </button>
          {variants.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <EvolutionPanel
                variants={variants}
                baseState={baseState}
                onPick={pickVariant}
              />
              <div className="help-text">
                Click one to make it your new origin.
              </div>
            </div>
          )}
        </div>

        <div className="section">
          <div className="subtitle">Save</div>
          <div className="btn-row">
            <button className="btn" onClick={exportPng}>PNG</button>
            <button className="btn" onClick={exportPreset}>JSON</button>
          </div>
          <div className="btn-row">
            <button className="btn full" onClick={importPreset}>Load Preset</button>
          </div>
          <div className="help-text">
            Seed: <code>{s.seed.toString(16).padStart(8, '0')}</code>
          </div>
        </div>
      </div>
    </div>
  )
}
