import type { Settings } from '../settings'
import type { BlobRegion } from '../types'

/**
 * ラベルのテンプレートを展開する。`{x}` は中心のX座標、`{x:03}` は3桁ゼロ埋め。
 * 未知のキーはそのまま残すので、入力途中のテンプレートでも描画は壊れない。
 */
export function formatLabel(
  template: string,
  r: BlobRegion,
  imageWidth: number,
  imageHeight: number,
  coordScale: Settings['label']['coordScale'],
): string {
  const sx = coordScale === 'percent' ? 100 / imageWidth : 1
  const sy = coordScale === 'percent' ? 100 / imageHeight : 1
  const values = {
    id: r.id,
    x: r.cx * sx,
    y: r.cy * sy,
    left: r.x * sx,
    top: r.y * sy,
    w: r.w * sx,
    h: r.h * sy,
    area: r.area,
    lum: r.luminance,
  }
  return template.replace(/\{(\w+)(?::(0?)(\d+))?\}/g, (match, key: string, zero: string, width: string) => {
    if (!(key in values)) return match
    const text = String(Math.round(values[key as keyof typeof values]))
    return width ? text.padStart(Number(width), zero ? '0' : ' ') : text
  })
}
