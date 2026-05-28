import React, { useEffect, useRef } from 'react'
import type { AppState, EngineSnapshot } from '../types'
import { createEngine } from '../engines'
import { Renderer } from '../render/Renderer'

interface Variant {
  snapshot: EngineSnapshot
  key: string
}

interface Props {
  variants: Variant[]
  baseState: AppState
  onPick: (snap: EngineSnapshot) => void
}

// Small offscreen previews per variant. We render ~20 frames into a tiny
// canvas to give the user a quick taste of each candidate.
const PREVIEW_SIZE = 200
const PREVIEW_FRAMES = 12

export const EvolutionPanel: React.FC<Props> = ({ variants, baseState, onPick }) => {
  const refs = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    variants.forEach((v, idx) => {
      const canvas = refs.current[idx]
      if (!canvas) return
      canvas.width = PREVIEW_SIZE
      canvas.height = PREVIEW_SIZE
      const renderer = new Renderer(canvas)
      const engine = createEngine(v.snapshot.engine, v.snapshot.seed)
      engine.restore(v.snapshot)
      // simulate a few frames so the preview is interesting
      for (let f = 0; f < PREVIEW_FRAMES; f++) {
        renderer.step(engine, baseState, f * 0.1)
      }
    })
  }, [variants, baseState])

  return (
    <div className="evolution-grid">
      {variants.map((v, idx) => (
        <div
          key={v.key}
          className="evolution-cell"
          onClick={() => onPick(v.snapshot)}
        >
          <canvas ref={(el) => (refs.current[idx] = el)} />
          <div className="badge">{String.fromCharCode(65 + idx)}</div>
        </div>
      ))}
    </div>
  )
}
