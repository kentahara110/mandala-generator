import React, { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AppState,
  EngineId,
} from './types'
import { makeInitialState } from './state/initialState'
import { createEngine, ENGINES } from './engines'
import type { GeneratorEngine } from './types'
import { Renderer } from './render/Renderer'
import { Slider } from './components/Slider'
import { EngineSelector } from './components/EngineSelector'
import { PaletteGrid } from './components/PaletteGrid'
import { LockToggle } from './components/LockToggle'
import { PALETTE_IDS } from './render/Palettes'

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

  // Layout: drawer (mobile/tablet) and immersive (full-screen mandala) modes.
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 1024)

  // Track viewport breakpoint so the resize logic below can switch between
  // the desktop 3-column layout and the mobile drawer layout.
  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Escape key exits immersive / closes drawer for quick recovery.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (immersive) setImmersive(false)
        else if (drawerOpen) setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [immersive, drawerOpen])

  const toggleImmersive = useCallback(() => {
    setImmersive((v) => {
      const next = !v
      // Best-effort browser fullscreen — silently ignored if denied.
      if (next && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      } else if (!next && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
      return next
    })
    setDrawerOpen(false)
  }, [])

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
    const MIN_DISPLAY = 280
    const MAX_INTERNAL = 820
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      // On compact screens (mobile/tablet) the panels are drawer overlays so
      // we let the canvas fill the available square area entirely. On
      // desktop we keep a small margin around the figure for breathing room.
      const compact = window.innerWidth < 1024
      const factor = compact ? 0.98 : 0.92
      const fit = Math.floor(Math.min(rect.width, rect.height) * factor)
      const upper = compact ? fit : Math.min(MAX_DISPLAY, fit)
      const display = Math.max(MIN_DISPLAY, upper)
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
      s.color.palette = PALETTE_IDS[Math.floor(Math.random() * PALETTE_IDS.length)]
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

  const appClass = [
    'app',
    isCompact ? 'compact' : '',
    drawerOpen ? 'drawer-open' : '',
    immersive ? 'immersive' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={appClass}>
      {/* Drawer toggle — only relevant on compact layouts. */}
      <button
        className="chrome-btn drawer-toggle"
        onClick={() => setDrawerOpen((v) => !v)}
        aria-label="Toggle controls drawer"
      >
        ☰
      </button>
      <div
        className="drawer-backdrop"
        onClick={() => setDrawerOpen(false)}
      />

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
          <Slider label="Symmetry" hint="回転対称の枚数" value={s.structure.symmetry} min={1} max={12} step={1}
            onChange={(v) => update((s) => { s.structure.symmetry = v })} />
          <Slider label="Mirror" hint="鏡像反射の強さ" value={s.structure.mirror} min={0} max={1}
            onChange={(v) => update((s) => { s.structure.mirror = v })} />
          <Slider label="Petals" hint="万華鏡の折りの数" value={s.structure.petals} min={2} max={16} step={1}
            onChange={(v) => update((s) => { s.structure.petals = v })} />
          <Slider label="Spiral" hint="渦の捻り具合" value={s.structure.spiral} min={-0.5} max={0.5}
            onChange={(v) => update((s) => { s.structure.spiral = v })} />
          <Slider label="Density" hint="描かれる点の密度" value={s.structure.density} min={0.05} max={1}
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
          <Slider label="Breath" hint="呼吸のようなゆっくりした揺らぎ" value={s.motion.breath} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.breath = v })} />
          <Slider label="Drift" hint="マンダラ全体のゆっくりした回転" value={s.motion.drift} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.drift = v })} />
          <Slider label="Turbulence" hint="不規則な擾乱" value={s.motion.turbulence} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.turbulence = v })} />
          <Slider label="Morph Speed" hint="形が変化する速さ" value={s.motion.morphSpeed} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.morphSpeed = v })} />
        </div>

        <div className="section">
          <div className="subtitle">
            <span>Engine Voice</span>
          </div>
          <Slider label="Chaos" hint="エンジン内部の発散具合" value={s.params.chaos} min={0} max={1}
            onChange={(v) => update((s) => { s.params.chaos = v })} />
          <Slider label="Flow" hint="軌道の滑らかさ・流れの強さ" value={s.params.flow} min={0} max={1}
            onChange={(v) => update((s) => { s.params.flow = v })} />
          <Slider label="Orbit" hint="回転バイアス" value={s.params.orbit} min={0} max={1}
            onChange={(v) => update((s) => { s.params.orbit = v })} />
          <Slider label="Organic" hint="有機的なノイズの強さ" value={s.params.organic} min={0} max={1}
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
        <button
          className="chrome-btn immersive-toggle"
          onClick={toggleImmersive}
          aria-label={immersive ? 'Exit immersive mode' : 'Enter immersive mode'}
          title={immersive ? 'Exit immersive (Esc)' : 'Immersive mode'}
        >
          {immersive ? '✕' : '⛶'}
        </button>
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
          <Slider label="Zoom" hint="表示倍率" value={s.rendering.zoom} min={0.1} max={2} step={0.05}
            display={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => update((s) => { s.rendering.zoom = v })} />
          <Slider label="Glow" hint="発光の強さ" value={s.rendering.glow} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.glow = v })} />
          <Slider label="Fade" hint="残像の持続時間" value={s.rendering.fade} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.fade = v })} />
          <Slider label="Thickness" hint="点・線の太さ" value={s.rendering.thickness} min={0.5} max={1.5} step={0.05}
            onChange={(v) => update((s) => { s.rendering.thickness = v })} />
          <Slider label="Bloom" hint="光のにじみ・幻想感" value={s.rendering.bloom} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.bloom = v })} />
          <Slider label="Saturation" hint="彩度" value={s.rendering.saturation} min={0} max={1.6}
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
          <Slider label="Hue Shift" hint="色相のずれ" value={s.color.hueShift} min={0} max={1}
            onChange={(v) => update((s) => { s.color.hueShift = v })} />
          <Slider label="Cosmic" hint="色の揺らぎ・宇宙感" value={s.color.cosmic} min={0} max={1}
            onChange={(v) => update((s) => { s.color.cosmic = v })} />
          <Slider label="Cycle" hint="時間とともに色が変化する速さ" value={s.color.cycleSpeed} min={0} max={1} step={0.01}
            display={(v) => (v < 0.005 ? 'off' : `${v.toFixed(2)}`)}
            onChange={(v) => update((s) => { s.color.cycleSpeed = v })} />
        </div>

        <div className="section">
          <div className="subtitle">Discover</div>
          <button className="btn primary full" onClick={mutateSlightly}>
            ✦ Mutate Slightly
          </button>
          <div className="help-text">
            現在の見た目を保ちつつ、微小な変異を加えます
          </div>
          <div style={{ height: 10 }} />
          <button className="btn danger full" onClick={randomize}>
            🎲 Randomize All
          </button>
          <div className="help-text">
            ロックされていない全パラメータをランダム化します。元の設定には戻せません。
          </div>
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
