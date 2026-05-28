import React from 'react'
import { ENGINES } from '../engines'
import type { EngineId } from '../types'

interface Props {
  active: EngineId
  onSelect: (id: EngineId) => void
}

export const EngineSelector: React.FC<Props> = ({ active, onSelect }) => {
  return (
    <div className="engine-grid">
      {ENGINES.map((e) => (
        <button
          key={e.id}
          className={`engine-btn ${active === e.id ? 'active' : ''}`}
          onClick={() => onSelect(e.id)}
        >
          <div className="name">{e.label}</div>
          <div className="tagline">{e.tagline}</div>
        </button>
      ))}
    </div>
  )
}
