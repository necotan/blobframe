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
function boxBlur(img: GrayImage, radius: number): GrayImage {
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

type Component = { minX: number; minY: number; maxX: number; maxY: number; count: number; lumSum: number }

function connectedComponents(img: GrayImage, mask: Uint8Array): Component[] {
  const { width: w, height: h } = img
  const labels = new Int32Array(w * h)
  const parent: number[] = [0]
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!
      a = parent[a]!
    }
    return a
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!mask[i]) continue
      const left = x > 0 ? labels[i - 1]! : 0
      const up = y > 0 ? labels[i - w]! : 0
      if (left && up) {
        const a = find(left)
        const b = find(up)
        labels[i] = Math.min(a, b)
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b)
      } else if (left || up) {
        labels[i] = left || up
      } else {
        labels[i] = parent.length
        parent.push(parent.length)
      }
    }
  }

  const components = new Map<number, Component>()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!labels[i]) continue
      const root = find(labels[i]!)
      const c = components.get(root)
      const lum = img.data[i]!
      if (c) {
        if (x < c.minX) c.minX = x
        if (x > c.maxX) c.maxX = x
        if (y < c.minY) c.minY = y
        if (y > c.maxY) c.maxY = y
        c.count++
        c.lumSum += lum
      } else {
        components.set(root, { minX: x, minY: y, maxX: x, maxY: y, count: 1, lumSum: lum })
      }
    }
  }
  return [...components.values()]
}

function iou(a: BlobRegion, b: BlobRegion): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const inter = ix * iy
  return inter / (a.w * a.h + b.w * b.h - inter)
}

function sameCenter(a: BlobRegion, b: BlobRegion): boolean {
  const limit = 0.15 * Math.max(a.w, a.h, b.w, b.h)
  return Math.abs(a.cx - b.cx) < limit && Math.abs(a.cy - b.cy) < limit
}

/**
 * 縮小済みのグレー画像から領域を検出し、元画像の座標で返す。
 * scale は 元画像の幅 / 処理画像の幅。
 */
export function detectThreshold(
  gray: GrayImage,
  scale: number,
  srcWidth: number,
  srcHeight: number,
  s: DetectSettings,
): BlobRegion[] {
  const img = boxBlur(gray, s.blur)
  const levels = Math.max(1, Math.round(s.levels))
  const mask = new Uint8Array(img.width * img.height)
  const candidates: BlobRegion[] = []

  for (let l = 0; l < levels; l++) {
    const t = levels === 1 ? s.thresholdMin : s.thresholdMin + ((s.thresholdMax - s.thresholdMin) * l) / (levels - 1)
    for (let i = 0; i < mask.length; i++) {
      const v = img.data[i]!
      mask[i] = s.target === 'bright' ? (v >= t ? 1 : 0) : v <= t ? 1 : 0
    }
    for (const c of connectedComponents(img, mask)) {
      const x0 = clamp(c.minX * scale - s.padding, 0, srcWidth)
      const y0 = clamp(c.minY * scale - s.padding, 0, srcHeight)
      const x1 = clamp((c.maxX + 1) * scale + s.padding, 0, srcWidth)
      const y1 = clamp((c.maxY + 1) * scale + s.padding, 0, srcHeight)
      const w = x1 - x0
      const h = y1 - y0
      if (w < s.minSize || h < s.minSize || w > s.maxSize || h > s.maxSize) continue
      candidates.push({
        id: 0,
        x: x0,
        y: y0,
        w,
        h,
        cx: x0 + w / 2,
        cy: y0 + h / 2,
        area: c.count * scale * scale,
        luminance: c.lumSum / c.count,
      })
    }
  }

  // 段階が隣り合うと同じ領域が同じ中心の入れ子の箱として何度も出て、ラベルが重なる。
  // 重なりが大きいか、中心がほぼ同じ箱は1つにまとめ、段階ごとに分かれた別の領域だけを残す
  candidates.sort((a, b) => b.area - a.area)
  const picked: BlobRegion[] = []
  for (const c of candidates) {
    if (picked.length >= s.maxCount) break
    if (picked.every((p) => iou(p, c) < 0.85 && !sameCenter(p, c))) picked.push(c)
  }
  picked.forEach((r, i) => (r.id = i + 1))
  return picked
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
