import React from 'react'

interface Props {
  locked: boolean
  onToggle: () => void
  /** Localized strings. Optional — defaults to English. */
  labels?: {
    locked: string
    unlocked: string
    titleLocked?: string
    titleUnlocked?: string
  }
}

export const LockToggle: React.FC<Props> = ({ locked, onToggle, labels }) => {
  const lockedLabel = labels?.locked ?? 'Locked'
  const unlockedLabel = labels?.unlocked ?? 'Lock'
  const titleLocked = labels?.titleLocked ?? 'Locked — protected from Randomize / Mutate'
  const titleUnlocked = labels?.titleUnlocked ?? 'Lock this section'
  return (
    <button
      className={`lock-toggle ${locked ? 'locked' : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      title={locked ? titleLocked : titleUnlocked}
      aria-pressed={locked}
    >
      <span className="lock-label">{locked ? lockedLabel : unlockedLabel}</span>
    </button>
  )
}
