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
      title={locked ? 'Locked — preserved on randomize / mutate' : 'Unlocked'}
    >
      {locked ? '●' : '○'}
    </button>
  )
}
