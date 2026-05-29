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
import { Section } from './components/Section'
import { PALETTE_IDS } from './render/Palettes'

type SectionId = 'engine' | 'structure' | 'motion' | 'params' | 'rendering' | 'color' | 'discover' | 'save'

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
  // Accordion: which sections are expanded. On compact this drives visibility;
  // on desktop the CSS forces every body open regardless of this state.
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set())
  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

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
    const goingIn = !immersive
    // Call the Fullscreen API SYNCHRONOUSLY here, directly inside the click
    // handler's call stack. Browsers (especially mobile Safari) gate
    // `requestFullscreen` to "user-activated" tasks; wrapping it in a
    // setState callback breaks that and the request is silently ignored.
    type AnyEl = HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>
      webkitRequestFullScreen?: () => void
      mozRequestFullScreen?: () => Promise<void>
      msRequestFullscreen?: () => Promise<void>
    }
    type AnyDoc = Document & {
      webkitFullscreenElement?: Element | null
      webkitExitFullscreen?: () => Promise<void>
      webkitCancelFullScreen?: () => void
      mozCancelFullScreen?: () => Promise<void>
      msExitFullscreen?: () => Promise<void>
    }
    const doc = document as AnyDoc
    const inFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement)
    try {
      if (goingIn && !inFs) {
        // documentElement (= <html>) is the most reliable target across
        // browsers — Safari, Chrome and Firefox all accept it.
        const el = document.documentElement as AnyEl
        const req =
          el.requestFullscreen ||
          el.webkitRequestFullscreen ||
          el.webkitRequestFullScreen ||
          el.mozRequestFullScreen ||
          el.msRequestFullscreen
        if (req) {
          const result = req.call(el)
          if (result && typeof (result as Promise<void>).catch === 'function') {
            ;(result as Promise<void>).catch(() => {})
          }
        }
      } else if (!goingIn && inFs) {
        const exit =
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.webkitCancelFullScreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen
        if (exit) {
          const result = exit.call(doc)
          if (result && typeof (result as Promise<void>).catch === 'function') {
            ;(result as Promise<void>).catch(() => {})
          }
        }
      }
    } catch {
      // ignore — immersive still works in-page even if the FS API rejects.
    }

    if (goingIn) {
      // YouTube-on-mobile-Safari trick: iOS only collapses the URL bar
      // when the page is scrollable and the user has scrolled past 0. The
      // app normally has `overflow: hidden` on <html> / <body> to lock the
      // layout, so we temporarily unlock and force a 1px scroll. The next
      // frame we re-lock — but the URL bar stays collapsed because Safari
      // only re-shows it on a scroll *toward* the top.
      const html = document.documentElement
      const body = document.body
      html.style.overflow = 'auto'
      body.style.overflow = 'auto'
      body.style.minHeight = 'calc(100vh + 1px)'
      requestAnimationFrame(() => {
        window.scrollTo(0, 1)
        // Re-lock shortly after so the user can't scroll the page accidentally.
        window.setTimeout(() => {
          html.style.overflow = ''
          body.style.overflow = ''
          body.style.minHeight = ''
        }, 120)
      })
    } else {
      // Make sure we leave the page in its locked state on exit.
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.minHeight = ''
      window.scrollTo(0, 0)
    }
    setImmersive(goingIn)
    setDrawerOpen(false)
  }, [immersive])

  // Keep our `immersive` state in sync if the user exits browser fullscreen
  // via a system gesture (Escape, swipe down, or the browser's own UI).
  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null }
      const inFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement)
      if (!inFs) {
        setImmersive((current) => (current ? false : current))
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
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
      // Structure lock now protects every structural knob, not just density,
      // matching the lock toggle the user actually sees on the section.
      s.structure.symmetry = 1 + Math.floor(Math.random() * 8)
      s.structure.mirror = Math.random() < 0.5 ? 0 : Math.random() * 0.8
      s.structure.petals = 2 + Math.floor(Math.random() * 10)
      s.structure.spiral = (Math.random() - 0.5) * 0.4
      s.structure.density = 0.4 + Math.random() * 0.5
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
      // Thickness is clamped to the slider's new 0.5–1.5 range.
      s.rendering.thickness = 0.7 + Math.random() * 0.8
      s.rendering.saturation = 0.7 + Math.random() * 0.6
    }
    if (!s.locks.params) {
      s.params.flow = 0.3 + Math.random() * 0.5
      s.params.chaos = 0.3 + Math.random() * 0.5
      s.params.orbit = Math.random()
      s.params.organic = 0.1 + Math.random() * 0.4
    }
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
        <span className="icon icon-hamburger" />
      </button>
      <div
        className="drawer-backdrop"
        onClick={() => setDrawerOpen(false)}
      />

      {/* CENTER — canvas (kept OUTSIDE the drawer-container so on compact
          it stays as the page background while the drawer slides over it). */}
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
          <span className={`icon ${immersive ? 'icon-close' : 'icon-expand'}`} />
        </button>
        <canvas ref={canvasRef} className="mandala" />
      </div>

      {/* On desktop the wrapper is `display: contents` so the grid sees the
          two panels directly. On compact it becomes the single scrollable
          drawer that contains both panels stacked vertically. */}
      <div className="drawer-container">

      {/* LEFT PANEL — engines + structure + motion */}
      <div className="panel">
        <Section
          title="Engine"
          open={openSections.has('engine')}
          onToggle={() => toggleSection('engine')}
        >
          <EngineSelector active={s.engine} onSelect={switchEngine} />
          <div className="help-text">
            Each engine is a different way of dreaming.
          </div>
        </Section>

        <Section
          title="Structure"
          open={openSections.has('structure')}
          onToggle={() => toggleSection('structure')}
          lock={{
            locked: s.locks.structure,
            onToggle: () => update((s) => { s.locks.structure = !s.locks.structure }),
          }}
        >
          <Slider label="Symmetry" hint="Number of radial copies" value={s.structure.symmetry} min={1} max={12} step={1}
            onChange={(v) => update((s) => { s.structure.symmetry = v })} />
          <Slider label="Mirror" hint="Mirror reflection strength" value={s.structure.mirror} min={0} max={1}
            onChange={(v) => update((s) => { s.structure.mirror = v })} />
          <Slider label="Petals" hint="Kaleidoscope fold count" value={s.structure.petals} min={2} max={16} step={1}
            onChange={(v) => update((s) => { s.structure.petals = v })} />
          <Slider label="Spiral" hint="Per-ring twist amount" value={s.structure.spiral} min={-0.5} max={0.5}
            onChange={(v) => update((s) => { s.structure.spiral = v })} />
          <Slider label="Density" hint="How densely points are drawn" value={s.structure.density} min={0.05} max={1}
            onChange={(v) => update((s) => { s.structure.density = v })} />
        </Section>

        <Section
          title="Motion"
          open={openSections.has('motion')}
          onToggle={() => toggleSection('motion')}
          lock={{
            locked: s.locks.motion,
            onToggle: () => update((s) => { s.locks.motion = !s.locks.motion }),
          }}
        >
          <Slider label="Breath" hint="Slow, breath-like modulation" value={s.motion.breath} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.breath = v })} />
          <Slider label="Drift" hint="Slow rotation of the whole mandala" value={s.motion.drift} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.drift = v })} />
          <Slider label="Turbulence" hint="Irregular noise perturbation" value={s.motion.turbulence} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.turbulence = v })} />
          <Slider label="Morph Speed" hint="How quickly the form evolves" value={s.motion.morphSpeed} min={0} max={1}
            onChange={(v) => update((s) => { s.motion.morphSpeed = v })} />
        </Section>

        <Section
          title="Engine Voice"
          open={openSections.has('params')}
          onToggle={() => toggleSection('params')}
          lock={{
            locked: s.locks.params,
            onToggle: () => update((s) => { s.locks.params = !s.locks.params }),
          }}
        >
          <Slider label="Chaos" hint="How divergent the attractor is" value={s.params.chaos} min={0} max={1}
            onChange={(v) => update((s) => { s.params.chaos = v })} />
          <Slider label="Flow" hint="Smoothness of the trajectories" value={s.params.flow} min={0} max={1}
            onChange={(v) => update((s) => { s.params.flow = v })} />
          <Slider label="Orbit" hint="Rotational bias" value={s.params.orbit} min={0} max={1}
            onChange={(v) => update((s) => { s.params.orbit = v })} />
          <Slider label="Organic" hint="Organic noise strength" value={s.params.organic} min={0} max={1}
            onChange={(v) => update((s) => { s.params.organic = v })} />
        </Section>
      </div>

      {/* RIGHT PANEL — rendering, color, actions */}
      <div className="panel right">
        <Section
          title="Rendering"
          open={openSections.has('rendering')}
          onToggle={() => toggleSection('rendering')}
          lock={{
            locked: s.locks.rendering,
            onToggle: () => update((s) => { s.locks.rendering = !s.locks.rendering }),
          }}
        >
          <Slider label="Zoom" hint="View zoom" value={s.rendering.zoom} min={0.1} max={2} step={0.05}
            display={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => update((s) => { s.rendering.zoom = v })} />
          <Slider label="Glow" hint="Glow intensity" value={s.rendering.glow} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.glow = v })} />
          <Slider label="Fade" hint="Trail persistence" value={s.rendering.fade} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.fade = v })} />
          <Slider label="Thickness" hint="Point / line thickness" value={s.rendering.thickness} min={0.5} max={1.5} step={0.05}
            onChange={(v) => update((s) => { s.rendering.thickness = v })} />
          <Slider label="Bloom" hint="Soft bloom-like glow" value={s.rendering.bloom} min={0} max={1}
            onChange={(v) => update((s) => { s.rendering.bloom = v })} />
          <Slider label="Saturation" hint="Color saturation" value={s.rendering.saturation} min={0} max={1.6}
            onChange={(v) => update((s) => { s.rendering.saturation = v })} />
        </Section>

        <Section
          title="Color"
          open={openSections.has('color')}
          onToggle={() => toggleSection('color')}
          lock={{
            locked: s.locks.color,
            onToggle: () => update((s) => { s.locks.color = !s.locks.color }),
          }}
        >
          <PaletteGrid
            active={s.color.palette}
            onSelect={(p) => update((s) => { s.color.palette = p })}
          />
          <Slider label="Hue Shift" hint="Rotate the palette hue" value={s.color.hueShift} min={0} max={1}
            onChange={(v) => update((s) => { s.color.hueShift = v })} />
          <Slider label="Cosmic" hint="Color modulation amplitude" value={s.color.cosmic} min={0} max={1}
            onChange={(v) => update((s) => { s.color.cosmic = v })} />
          <Slider label="Cycle" hint="Auto colour drift over time" value={s.color.cycleSpeed} min={0} max={1} step={0.01}
            display={(v) => (v < 0.005 ? 'off' : `${v.toFixed(2)}`)}
            onChange={(v) => update((s) => { s.color.cycleSpeed = v })} />
        </Section>

        <Section
          title="Discover"
          open={openSections.has('discover')}
          onToggle={() => toggleSection('discover')}
        >
          <button className="btn primary full" onClick={mutateSlightly}>
            ✦ Mutate Slightly
          </button>
          <div className="help-text">
            Nudge the shape while preserving the current look.
          </div>
          <div style={{ height: 10 }} />
          <button className="btn shuffle full" onClick={randomize}>
            ✦ Shuffle All
          </button>
          <div className="help-text">
            Randomizes every unlocked section. There's no undo.
          </div>
        </Section>

        <Section
          title="Save"
          open={openSections.has('save')}
          onToggle={() => toggleSection('save')}
        >
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
        </Section>
      </div>

      </div>{/* /.drawer-container */}
    </div>
  )
}
