import React, { useMemo } from 'react'
import type { PaletteId } from '../types'
import { PALETTE_IDS, samplePalette } from '../render/Palettes'

interface Props {
  active: PaletteId
  onSelect: (id: PaletteId) => void
}

const PALETTE_LABELS: Record<PaletteId, string> = {
  cosmic: 'Cosmic',
  neon: 'Neon',
  monochrome: 'Mono',
  gold: 'Gold',
  ultraviolet: 'UV',
  bioluminescent: 'Bio',
  ember: 'Ember',
  deepsea: 'Deep Sea',
}

function gradientFor(id: PaletteId): string {
  const stops: string[] = []
  for (let i = 0; i <= 6; i++) {
    const t = i / 6
    const c = samplePalette(id, t, 0, 1)
    stops.push(`rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}) ${Math.round(t * 100)}%`)
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

export const PaletteGrid: React.FC<Props> = ({ active, onSelect }) => {
  const gradients = useMemo(() => {
    const out: Record<string, string> = {}
    for (const id of PALETTE_IDS) out[id] = gradientFor(id)
    return out
  }, [])
  return (
    <div className="palette-grid">
      {PALETTE_IDS.map((id) => (
        <div
          key={id}
          className={`palette-chip ${active === id ? 'active' : ''}`}
          style={{ background: gradients[id] }}
          onClick={() => onSelect(id)}
        >
          <div className="name">{PALETTE_LABELS[id]}</div>
        </div>
      ))}
    </div>
  )
}
