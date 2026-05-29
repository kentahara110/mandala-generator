import React from 'react'
import { ENGINES } from '../engines'
import type { EngineId } from '../types'
import type { EngineCopy } from '../i18n'

interface Props {
  active: EngineId
  onSelect: (id: EngineId) => void
  /** Localized label + tagline per engine. Falls back to the descriptor's
   *  built-in English copy if a key is missing. */
  labels?: Record<EngineId, EngineCopy>
}

export const EngineSelector: React.FC<Props> = ({ active, onSelect, labels }) => {
  return (
    <div className="engine-grid">
      {ENGINES.map((e) => {
        const copy = labels?.[e.id]
        return (
          <button
            key={e.id}
            className={`engine-btn ${active === e.id ? 'active' : ''}`}
            onClick={() => onSelect(e.id)}
          >
            <div className="name">{copy?.label ?? e.label}</div>
            <div className="tagline">{copy?.tagline ?? e.tagline}</div>
          </button>
        )
      })}
    </div>
  )
}
