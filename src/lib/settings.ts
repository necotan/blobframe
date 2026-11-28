export type DetectSettings = {
  method: 'threshold' | 'quadtree'
  target: 'bright' | 'dark'
  thresholdMin: number
  thresholdMax: number
  /** thresholdMin から thresholdMax までを何段階で切るか。段階ごとの領域を合わせると大小の箱が入れ子になる */
  levels: number
  /** quadtree: セル内の明るさの標準偏差(0-255)がこれを超えると4分割する。小さいほど細かく分かれる */
  quadDetail: number
  /** quadtree: 分割の最大回数 */
  quadDepth: number
  /** quadtree: これより分割回数の少ない(大きい)セルは箱にしない。1回分割すると辺の長さは画像の 1/2 */
  quadMinDepth: number
  blur: number
  /** 検出時の長辺ピクセル数。元画像はこのサイズに縮小して処理する */
  processSize: number
  minSize: number
  maxSize: number
  maxCount: number
  padding: number
  /** 画像の端からこの幅(元画像の px)に一部でもかかる箱は出さない。0 でオフ */
  margin: number
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
    /** ぼかしの強さ(u)。0 でオフ */
    blur: number
    /** モザイクの1マスの大きさ(u)。0 でオフ。blur と両方あるときはモザイクになる */
    mosaic: number
    /** tintColor で色を付ける強さ 0-1。明るさは残して色味だけ置き換える。0 でオフ */
    tint: number
    tintColor: string
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
    rule: 'none' | 'chain' | 'nearest' | 'snapline'
    neighbors: number
    /** snapline: 線を出す画像上の点。bottom と top は辺の中央から箱の同じ側の辺の中央へ、center は中心同士を結ぶ */
    origin: 'bottom' | 'center' | 'top'
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

const WHITE = '#ffffff'

export const DEFAULT_SETTINGS: Settings = {
  detect: {
    method: 'threshold',
    target: 'bright',
    thresholdMin: 90,
    thresholdMax: 200,
    levels: 4,
    quadDetail: 20,
    quadDepth: 6,
    quadMinDepth: 2,
    blur: 2,
    processSize: 480,
    minSize: 20,
    maxSize: 2000,
    maxCount: 40,
    padding: 4,
    margin: 0,
  },
  background: {
    dim: 0.2,
    mono: false,
  },
  effect: {
    invert: false,
    mono: false,
    zoom: 1,
    blur: 0,
    mosaic: 0,
    tint: 0,
    tintColor: '#ff3b3b',
  },
  fill: {
    mode: 'none',
    color: WHITE,
    opacity: 0.35,
    meshSpacing: 3,
    meshWidth: 0.6,
  },
  stroke: {
    enabled: true,
    style: 'solid',
    color: WHITE,
    width: 1,
  },
  lines: {
    rule: 'nearest',
    neighbors: 1,
    origin: 'bottom',
    shape: 'straight',
    curvature: 0.3,
    dashed: false,
    color: WHITE,
    width: 1,
    opacity: 0.6,
  },
  marker: {
    shape: 'cross',
    size: 8,
    color: WHITE,
  },
  label: {
    enabled: true,
    template: 'X{x:03}Y{y:03}',
    coordScale: 'percent',
    position: 'top-left',
    size: 12,
    color: '#000000',
    background: true,
    backgroundColor: WHITE,
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
