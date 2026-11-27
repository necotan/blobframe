import { DEFAULT_SETTINGS, mergeSettings, type Settings } from './settings'

type Overrides = { [G in keyof Settings]?: Partial<Settings[G]> }

export type Preset = { id: string; name: string; settings: Settings }

// 既定値との差分だけを書き、残りは mergeSettings で埋める
function preset(id: string, name: string, overrides: Overrides): Preset {
  return { id, name, settings: mergeSettings(DEFAULT_SETTINGS, overrides) }
}

const WHITE = '#ffffff'
const AMBER = '#ffc23d'
const RED = '#ff3b3b'
const CYAN = '#3dd8ff'

/**
 * 標準プリセット。適用すると検出も含めて設定全体を置き換える。
 * 値はパネルの範囲と刻み幅に合わせ、色は小文字の #rrggbb で書くこと。パネルが丸めて書き戻すと、適用直後から Custom と表示される。
 */
export const PRESETS: Preset[] = [
  preset('default', 'Default', {}),
  preset('tracker', 'Tracker', {
    background: { dim: 0.35, mono: true },
    effect: { mono: false },
    fill: { mode: 'none' },
    stroke: { style: 'corners', color: WHITE, width: 1.5 },
    lines: { rule: 'nearest', neighbors: 2, shape: 'straight', dashed: false, color: WHITE, width: 0.5, opacity: 0.5 },
    marker: { shape: 'cross', size: 6, color: WHITE },
    label: { template: 'ID{id:02} {x:03},{y:03}', size: 10, color: WHITE, background: false },
  }),
  preset('quadtree-mesh', 'Quadtree Mesh', {
    detect: { method: 'quadtree', maxCount: 120, padding: 0 },
    background: { dim: 0.45, mono: true },
    fill: { color: AMBER, opacity: 0.4 },
    stroke: { color: AMBER, width: 1 },
    lines: { rule: 'none' },
    marker: { shape: 'none' },
    label: { enabled: false },
  }),
  preset('minimal', 'Minimal', {
    background: { dim: 0 },
    effect: { mono: false },
    fill: { mode: 'none' },
    stroke: { color: WHITE, width: 1 },
    lines: { rule: 'none' },
    marker: { shape: 'none' },
    label: { enabled: false },
  }),
  preset('invert', 'Invert', {
    background: { dim: 0, mono: true },
    effect: { invert: true, mono: false },
    fill: { mode: 'none' },
    stroke: { color: RED, width: 2 },
    lines: { rule: 'chain', shape: 'straight', dashed: false, color: RED, width: 1, opacity: 1 },
    marker: { shape: 'dot', size: 6, color: RED },
    label: { template: '{id:02}', position: 'inside', color: '#000000', backgroundColor: RED },
  }),
  preset('blueprint', 'Blueprint', {
    background: { dim: 0.5, mono: true },
    fill: { mode: 'solid', color: CYAN, opacity: 0.1 },
    stroke: { style: 'dashed', color: CYAN, width: 1 },
    lines: { rule: 'chain', shape: 'curve', curvature: 0.4, dashed: false, color: CYAN, width: 1, opacity: 0.7 },
    marker: { shape: 'circle', size: 10, color: CYAN },
    label: { template: 'x={x} y={y}', coordScale: 'pixel', position: 'bottom-left', size: 11, color: CYAN, background: false },
  }),
]

/** 設定がどれかのプリセットと一致すればその id、そうでなければ null。 */
export function matchPreset(settings: Settings): string | null {
  return PRESETS.find((p) => sameSettings(p.settings, settings))?.id ?? null
}

function sameSettings(a: Settings, b: Settings): boolean {
  return (Object.keys(a) as (keyof Settings)[]).every((group) => {
    const ga = a[group] as Record<string, unknown>
    const gb = b[group] as Record<string, unknown>
    return Object.keys(ga).every((key) => {
      const va = ga[key]
      const vb = gb[key]
      // パネルは刻み幅で丸めるときに 0.35 を 0.35000000000000003 のように書き戻すので、数値は誤差を許す
      return typeof va === 'number' && typeof vb === 'number' ? Math.abs(va - vb) < 1e-9 : va === vb
    })
  })
}
