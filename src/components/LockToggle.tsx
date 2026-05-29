import React from 'react'

interface Props {
  locked: boolean
  onToggle: () => void
}

export const LockToggle: React.FC<Props> = ({ locked, onToggle }) => {
  return (
    <button
      className={`lock-toggle ${locked ? 'locked' : ''}`}
      onClick={onToggle}
      title={locked ? 'Locked — protected from Randomize / Mutate' : 'Lock this section'}
      aria-pressed={locked}
    >
      <span className="lock-label">{locked ? 'Locked' : 'Lock'}</span>
    </button>
  )
}
