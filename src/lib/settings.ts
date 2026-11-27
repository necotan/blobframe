export type DetectSettings = {
  method: 'threshold'
  target: 'bright' | 'dark'
  thresholdMin: number
  thresholdMax: number
  /** thresholdMin から thresholdMax までを何段階で切るか。段階ごとの領域を合わせると大小の箱が入れ子になる */
  levels: number
  blur: number
  /** 検出時の長辺ピクセル数。元画像はこのサイズに縮小して処理する */
  processSize: number
  minSize: number
  maxSize: number
  maxCount: number
  padding: number
}

export type Settings = {
  detect: DetectSettings
  background: {
    dim: number
    mono: boolean
  }
  effect: {
    invert: boolean
    mono: boolean
    zoom: number
  }
  fill: {
    mode: 'none' | 'solid' | 'mesh'
    color: string
    opacity: number
    meshSpacing: number
    meshWidth: number
  }
  stroke: {
    enabled: boolean
    style: 'solid' | 'dashed' | 'corners'
    color: string
    width: number
  }
  lines: {
    rule: 'none' | 'chain' | 'nearest'
    neighbors: number
    shape: 'straight' | 'curve'
    curvature: number
    dashed: boolean
    color: string
    width: number
    opacity: number
  }
  marker: {
    shape: 'none' | 'cross' | 'dot' | 'circle'
    size: number
    color: string
  }
  label: {
    enabled: boolean
    template: string
    coordScale: 'pixel' | 'percent'
    position: 'top-left' | 'inside' | 'center' | 'bottom-left'
    size: number
    color: string
    background: boolean
    backgroundColor: string
  }
}

const GREEN = '#3dff3d'

export const DEFAULT_SETTINGS: Settings = {
  detect: {
    method: 'threshold',
    target: 'bright',
    thresholdMin: 90,
    thresholdMax: 200,
    levels: 4,
    blur: 2,
    processSize: 480,
    minSize: 20,
    maxSize: 2000,
    maxCount: 40,
    padding: 4,
  },
  background: {
    dim: 0.2,
    mono: false,
  },
  effect: {
    invert: false,
    mono: true,
    zoom: 1,
  },
  fill: {
    mode: 'mesh',
    color: GREEN,
    opacity: 0.35,
    meshSpacing: 3,
    meshWidth: 0.6,
  },
  stroke: {
    enabled: true,
    style: 'solid',
    color: GREEN,
    width: 1.5,
  },
  lines: {
    rule: 'nearest',
    neighbors: 1,
    shape: 'curve',
    curvature: 0.3,
    dashed: true,
    color: GREEN,
    width: 1,
    opacity: 0.8,
  },
  marker: {
    shape: 'cross',
    size: 8,
    color: GREEN,
  },
  label: {
    enabled: true,
    template: 'X{x:03}Y{y:03}',
    coordScale: 'percent',
    position: 'top-left',
    size: 12,
    color: '#000000',
    background: true,
    backgroundColor: GREEN,
  },
}

export function cloneSettings(s: Settings): Settings {
  return structuredClone(s)
}

/**
 * 保存済み JSON を現在の設定に重ねる。
 * 古いバージョンの JSON に無いキーは既定値のまま残り、未知のキーや型の違う値は捨てる。
 */
export function mergeSettings(base: Settings, input: unknown): Settings {
  const result = cloneSettings(base)
  if (typeof input !== 'object' || input === null) return result
  const src = input as Record<string, unknown>
  for (const group of Object.keys(result) as (keyof Settings)[]) {
    const srcGroup = src[group]
    if (typeof srcGroup !== 'object' || srcGroup === null) continue
    const target = result[group] as Record<string, unknown>
    for (const key of Object.keys(target)) {
      const value = (srcGroup as Record<string, unknown>)[key]
      if (value !== undefined && typeof value === typeof target[key]) target[key] = value
    }
  }
  return result
}
