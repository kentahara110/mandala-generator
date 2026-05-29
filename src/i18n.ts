import type { EngineId } from './types'

export type Lang = 'ja' | 'en'

export interface EngineCopy {
  label: string
  tagline: string
}

export interface Translations {
  // Brand / chrome
  brand: string
  langSwitchTitle: string

  // Section titles
  sectionEngine: string
  sectionStructure: string
  sectionMotion: string
  sectionParams: string
  sectionRendering: string
  sectionColor: string
  sectionDiscover: string
  sectionSave: string

  // Engine intro
  engineHelp: string

  // Engines (label + tagline)
  engines: Record<EngineId, EngineCopy>

  // Lock toggle
  lockLocked: string
  lockUnlocked: string
  lockTitleLocked: string
  lockTitleUnlocked: string

  // Slider labels + hints
  symmetry: string;       symmetryHint: string
  mirror: string;         mirrorHint: string
  petals: string;         petalsHint: string
  spiral: string;         spiralHint: string
  density: string;        densityHint: string

  breath: string;         breathHint: string
  drift: string;          driftHint: string
  turbulence: string;     turbulenceHint: string
  morphSpeed: string;     morphSpeedHint: string

  chaos: string;          chaosHint: string
  flow: string;           flowHint: string
  orbit: string;          orbitHint: string
  organic: string;        organicHint: string

  zoom: string;           zoomHint: string
  glow: string;           glowHint: string
  fade: string;           fadeHint: string
  thickness: string;      thicknessHint: string
  bloom: string;          bloomHint: string
  saturation: string;     saturationHint: string

  hueShift: string;       hueShiftHint: string
  cosmic: string;         cosmicHint: string
  cycle: string;          cycleHint: string
  cycleOff: string

  // Discover
  mutateSlightly: string
  mutateHelp: string
  shuffleAll: string
  shuffleHelp: string

  // Save
  exportPng: string
  exportJson: string
  loadPreset: string
  seedLabel: string

  // Aria / titles
  drawerToggleAria: string
  enterImmersive: string
  exitImmersive: string
}

const ja: Translations = {
  brand: 'Generative Mandala Laboratory',
  langSwitchTitle: '言語を切り替える',

  sectionEngine: 'エンジン',
  sectionStructure: '構造',
  sectionMotion: '動き',
  sectionParams: 'エンジンの個性',
  sectionRendering: '描画',
  sectionColor: '色',
  sectionDiscover: '発見',
  sectionSave: '保存',

  engineHelp: 'それぞれのエンジンが、異なる「夢の見方」をします。',

  engines: {
    clifford: { label: 'Clifford', tagline: '絹のような糸' },
    dejong:   { label: 'De Jong',  tagline: '織りなされる帳' },
    lorenz:   { label: 'Lorenz',   tagline: '蝶の波' },
    flow:     { label: 'Flow',     tagline: '極の流れ' },
    reaction: { label: 'Reaction', tagline: '生きた珊瑚' },
    lsystem:  { label: 'L-System', tagline: '枝分かれする文法' },
    flame:    { label: 'Flame',    tagline: '燃える残光' },
  },

  lockLocked: 'ロック中',
  lockUnlocked: 'ロック',
  lockTitleLocked: 'ロック中 — ランダム化/変異から保護されます',
  lockTitleUnlocked: 'このセクションをロック',

  symmetry: 'シンメトリー', symmetryHint: '回転対称の枚数',
  mirror: 'ミラー',         mirrorHint: '鏡像反射の強さ',
  petals: 'ペタル',           petalsHint: '万華鏡の折り数',
  spiral: 'スパイラル',     spiralHint: 'リングごとの捻り',
  density: '密度',          densityHint: '描画される点の密度',

  breath: '呼吸',           breathHint: '呼吸のような遅い揺らぎ',
  drift: 'ドリフト',         driftHint: 'マンダラ全体のゆっくりした回転',
  turbulence: 'ゆらぎ',       turbulenceHint: '不規則なノイズの揺らぎ',
  morphSpeed: 'スピード',   morphSpeedHint: '形が変化していく速さ',

  chaos: 'カオス',          chaosHint: 'アトラクタの発散',
  flow: '流れ',             flowHint: '軌道の滑らかさ',
  orbit: '軌道',            orbitHint: '回転',
  organic: '有機性',        organicHint: '有機的な動き',

  zoom: 'ズーム',           zoomHint: '表示倍率',
  glow: '発光',             glowHint: '発光の強さ',
  fade: 'フェード',         fadeHint: '残像の持続',
  thickness: '太さ',        thicknessHint: '点や線の太さ',
  bloom: 'ブルーム',         bloomHint: '光のにじむような幻想感',
  saturation: '彩度',       saturationHint: '色の鮮やかさ',

  hueShift: '色相シフト',   hueShiftHint: 'パレットの色相を動かす',
  cosmic: 'コズミック',     cosmicHint: '色の揺らぎ',
  cycle: 'サイクル',        cycleHint: '時間とともに色が自動で漂う',
  cycleOff: 'オフ',

  mutateSlightly: '✦ 微小変異',
  mutateHelp: '今の見た目を保ちながら、少しだけ揺らぎを加えます。',
  shuffleAll: '✦ シャッフル',
  shuffleHelp: 'ロックされていない項目を全てランダム化します。',

  exportPng: 'PNG',
  exportJson: 'JSON',
  loadPreset: 'プリセット読込',
  seedLabel: 'Seed:',

  drawerToggleAria: 'コントロールパネルを開閉',
  enterImmersive: '全画面モード',
  exitImmersive: '全画面解除 (Esc)',
}

const en: Translations = {
  brand: 'Generative Mandala Laboratory',
  langSwitchTitle: 'Switch language',

  sectionEngine: 'Engine',
  sectionStructure: 'Structure',
  sectionMotion: 'Motion',
  sectionParams: 'Engine Voice',
  sectionRendering: 'Rendering',
  sectionColor: 'Color',
  sectionDiscover: 'Discover',
  sectionSave: 'Save',

  engineHelp: 'Each engine is a different way of dreaming.',

  engines: {
    clifford: { label: 'Clifford', tagline: 'Silken filaments' },
    dejong:   { label: 'De Jong',  tagline: 'Woven veil' },
    lorenz:   { label: 'Lorenz',   tagline: 'Butterfly tide' },
    flow:     { label: 'Flow',     tagline: 'Polar currents' },
    reaction: { label: 'Reaction', tagline: 'Living coral' },
    lsystem:  { label: 'L-System', tagline: 'Branching grammar' },
    flame:    { label: 'Flame',    tagline: 'Fractal ember' },
  },

  lockLocked: 'Locked',
  lockUnlocked: 'Lock',
  lockTitleLocked: 'Locked — protected from Randomize / Mutate',
  lockTitleUnlocked: 'Lock this section',

  symmetry: 'Symmetry',   symmetryHint: 'Number of radial copies',
  mirror: 'Mirror',       mirrorHint: 'Mirror reflection strength',
  petals: 'Petals',       petalsHint: 'Kaleidoscope fold count',
  spiral: 'Spiral',       spiralHint: 'Per-ring twist amount',
  density: 'Density',     densityHint: 'How densely points are drawn',

  breath: 'Breath',           breathHint: 'Slow, breath-like modulation',
  drift: 'Drift',             driftHint: 'Slow rotation of the whole mandala',
  turbulence: 'Turbulence',   turbulenceHint: 'Irregular noise perturbation',
  morphSpeed: 'Morph Speed',  morphSpeedHint: 'How quickly the form evolves',

  chaos: 'Chaos',         chaosHint: 'How divergent the attractor is',
  flow: 'Flow',           flowHint: 'Smoothness of the trajectories',
  orbit: 'Orbit',         orbitHint: 'Rotational bias',
  organic: 'Organic',     organicHint: 'Organic noise strength',

  zoom: 'Zoom',                 zoomHint: 'View zoom',
  glow: 'Glow',                 glowHint: 'Glow intensity',
  fade: 'Fade',                 fadeHint: 'Trail persistence',
  thickness: 'Thickness',       thicknessHint: 'Point / line thickness',
  bloom: 'Bloom',               bloomHint: 'Soft bloom-like glow',
  saturation: 'Saturation',     saturationHint: 'Color saturation',

  hueShift: 'Hue Shift',  hueShiftHint: 'Rotate the palette hue',
  cosmic: 'Cosmic',       cosmicHint: 'Color modulation amplitude',
  cycle: 'Cycle',         cycleHint: 'Auto colour drift over time',
  cycleOff: 'off',

  mutateSlightly: '✦ Mutate Slightly',
  mutateHelp: 'Nudge the shape while preserving the current look.',
  shuffleAll: '✦ Shuffle All',
  shuffleHelp: "Randomizes every unlocked section. There's no undo.",

  exportPng: 'PNG',
  exportJson: 'JSON',
  loadPreset: 'Load Preset',
  seedLabel: 'Seed:',

  drawerToggleAria: 'Toggle controls drawer',
  enterImmersive: 'Immersive mode',
  exitImmersive: 'Exit immersive (Esc)',
}

export const translations: Record<Lang, Translations> = { ja, en }

export const DEFAULT_LANG: Lang = 'ja'

const LS_KEY = 'mandala.lang'

export function loadLang(): Lang {
  try {
    const v = window.localStorage.getItem(LS_KEY)
    if (v === 'ja' || v === 'en') return v
  } catch {
    // ignore — fall through to default
  }
  return DEFAULT_LANG
}

export function persistLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LS_KEY, lang)
  } catch {
    // ignore quota / privacy mode
  }
}
