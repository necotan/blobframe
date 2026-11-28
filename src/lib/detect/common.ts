import type { DetectSettings } from '../settings'
import type { BlobRegion } from '../types'

export type GrayImage = { data: Uint8ClampedArray; width: number; height: number }

export function toGray(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const data = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; p < data.length; i += 4, p++) {
    // Rec.709 の輝度係数
    data[p] = 0.2126 * rgba[i]! + 0.7152 * rgba[i + 1]! + 0.0722 * rgba[i + 2]!
  }
  return { data, width, height }
}

// 横と縦の移動平均を分けて行い、半径に関係なく O(画素数) で済ませる
export function boxBlur(img: GrayImage, radius: number): GrayImage {
  const r = Math.round(radius)
  if (r <= 0) return img
  const { width: w, height: h } = img
  const tmp = new Float32Array(w * h)
  const out = new Uint8ClampedArray(w * h)
  const size = r * 2 + 1
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = 0
    for (let x = -r; x <= r; x++) sum += img.data[row + clamp(x, 0, w - 1)]!
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / size
      sum += img.data[row + clamp(x + r + 1, 0, w - 1)]! - img.data[row + clamp(x - r, 0, w - 1)]!
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x]!
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size
      sum += tmp[clamp(y + r + 1, 0, h - 1) * w + x]! - tmp[clamp(y - r, 0, h - 1) * w + x]!
    }
  }
  return { data: out, width: w, height: h }
}

/** 処理画像のピクセルを元画像のピクセルに直すための値。scale は 元画像の幅 / 処理画像の幅 */
export type SourceFrame = { scale: number; width: number; height: number }

/**
 * 処理画像上の矩形(x1, y1 は含まない)を元画像の座標に直し、padding を足して BlobRegion にする。
 * minSize / maxSize に収まらないか、画像の端の margin にかかるときは null。id は 0 のままなので、並びを決めた後に振ること。
 */
export function toRegion(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pixelCount: number,
  luminance: number,
  src: SourceFrame,
  s: DetectSettings,
): BlobRegion | null {
  // 保存データは型しか確かめていないので、負の値はオフとして扱う
  const m = Math.max(0, s.margin)
  const bx0 = x0 * src.scale
  const by0 = y0 * src.scale
  const bx1 = x1 * src.scale
  const by1 = y1 * src.scale
  // 0 のときは確かめない。画像の端に接した箱が浮動小数の誤差で落ちないようにするため
  if (m > 0 && (bx0 < m || by0 < m || bx1 > src.width - m || by1 > src.height - m)) return null
  // padding で余白の中に描かれないよう、画像の端ではなく余白の内側で切る
  const left = clamp(bx0 - s.padding, m, src.width - m)
  const top = clamp(by0 - s.padding, m, src.height - m)
  const right = clamp(bx1 + s.padding, m, src.width - m)
  const bottom = clamp(by1 + s.padding, m, src.height - m)
  const w = right - left
  const h = bottom - top
  if (w < s.minSize || h < s.minSize || w > s.maxSize || h > s.maxSize) return null
  return {
    id: 0,
    x: left,
    y: top,
    w,
    h,
    cx: left + w / 2,
    cy: top + h / 2,
    area: pixelCount * src.scale * src.scale,
    luminance,
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/**
 * 面積の大きい順に maxCount 個まで選び、id を 1 から振って返す。
 * すでに選んだ箱と maxOverlap を超えて重なる箱と、isDuplicate が true を返す箱は飛ばす。
 */
export function pickRegions(
  candidates: BlobRegion[],
  s: DetectSettings,
  isDuplicate?: (kept: BlobRegion, candidate: BlobRegion) => boolean,
): BlobRegion[] {
  // 保存データは型しか確かめていない。負の値のままだと重ならない箱まで消えるので範囲に収める
  const limit = clamp(s.maxOverlap, 0, 1)
  // 交わりを小さいほうの面積で割るので、入れ子は 1 になり、IoU と違って大きさが違っても確実に消える
  const overlaps = (a: BlobRegion, b: BlobRegion) => {
    const inter = intersection(a, b)
    return inter > 0 && inter / Math.min(a.w * a.h, b.w * b.h) > limit
  }
  candidates.sort((a, b) => b.area - a.area)
  const picked: BlobRegion[] = []
  for (const c of candidates) {
    if (picked.length >= s.maxCount) break
    if (picked.some((p) => isDuplicate?.(p, c) || (limit < 1 && overlaps(p, c)))) continue
    picked.push(c)
  }
  picked.forEach((r, i) => (r.id = i + 1))
  return picked
}

export function iou(a: BlobRegion, b: BlobRegion): number {
  const inter = intersection(a, b)
  return inter / (a.w * a.h + b.w * b.h - inter)
}

function intersection(a: BlobRegion, b: BlobRegion): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return ix * iy
}
