import type { EngineId, GeneratorEngine } from '../types'
import { CliffordEngine } from './CliffordEngine'
import { DeJongEngine } from './DeJongEngine'
import { LorenzEngine } from './LorenzEngine'
import { FlowEngine } from './FlowEngine'
import { ReactionEngine } from './ReactionEngine'
import { LSystemEngine } from './LSystemEngine'
import { FlameEngine } from './FlameEngine'

export interface EngineDescriptor {
  id: EngineId
  label: string
  tagline: string
  factory: (seed?: number) => GeneratorEngine
}

export const ENGINES: readonly EngineDescriptor[] = [
  { id: 'clifford', label: 'Clifford', tagline: 'Silken filaments', factory: (s) => new CliffordEngine(s) },
  { id: 'dejong', label: 'De Jong', tagline: 'Woven veil', factory: (s) => new DeJongEngine(s) },
  { id: 'lorenz', label: 'Lorenz', tagline: 'Butterfly tide', factory: (s) => new LorenzEngine(s) },
  { id: 'flow', label: 'Flow', tagline: 'Polar currents', factory: (s) => new FlowEngine(s) },
  { id: 'reaction', label: 'Reaction', tagline: 'Living coral', factory: (s) => new ReactionEngine(s) },
  { id: 'lsystem', label: 'L-System', tagline: 'Branching grammar', factory: (s) => new LSystemEngine(s) },
  { id: 'flame', label: 'Flame', tagline: 'Fractal ember', factory: (s) => new FlameEngine(s) },
] as const

export function createEngine(id: EngineId, seed?: number): GeneratorEngine {
  const desc = ENGINES.find((e) => e.id === id)
  if (!desc) throw new Error(`Unknown engine: ${id}`)
  return desc.factory(seed)
}
