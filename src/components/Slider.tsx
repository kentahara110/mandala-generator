import React from 'react'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  display?: (v: number) => string
  onChange: (v: number) => void
}

export const Slider: React.FC<Props> = ({ label, value, min, max, step = 0.01, display, onChange }) => {
  const formatted = display
    ? display(value)
    : Number.isInteger(step) || step >= 1
      ? Math.round(value).toString()
      : value.toFixed(2)
  return (
    <div className="slider-row">
      <div className="label">
        <span>{label}</span>
        <span className="val">{formatted}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}
