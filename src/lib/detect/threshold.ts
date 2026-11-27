import type { DetectSettings } from '../settings'
import type { BlobRegion } from '../types'
import { boxBlur, toRegion, type GrayImage, type SourceFrame } from './common'

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

/** 縮小済みのグレー画像から明るさのしきい値で領域を検出し、面積の大きい順に返す。 */
export function detectThreshold(gray: GrayImage, src: SourceFrame, s: DetectSettings): BlobRegion[] {
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
      const region = toRegion(c.minX, c.minY, c.maxX + 1, c.maxY + 1, c.count, c.lumSum / c.count, src, s)
      if (region) candidates.push(region)
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
