import type { Settings } from '../settings'
import type { BlobRegion } from '../types'

type Point = { x: number; y: number }

/**
 * 描く線分の両端を返す。`chain` は regions[0] を起点にするので、検出結果の並び(面積の大きい順)のまま渡すこと。
 */
export function connectionSegments(
  regions: BlobRegion[],
  s: Settings['lines'],
  imageWidth: number,
  imageHeight: number,
): [Point, Point][] {
  if (s.rule === 'snapline') return snaplines(regions, s.origin, imageWidth, imageHeight)
  return connectionPairs(regions, s).map(([a, b]) => [
    { x: a.cx, y: a.cy },
    { x: b.cx, y: b.cy },
  ])
}

function connectionPairs(regions: BlobRegion[], s: Settings['lines']): [BlobRegion, BlobRegion][] {
  if (regions.length < 2) return []
  if (s.rule === 'chain') return chain(regions)
  if (s.rule === 'nearest') return nearest(regions, Math.max(1, Math.round(s.neighbors)))
  return []
}

// ゲームの ESP 表示のように、画面の端から各箱へ1本ずつ引く。下からなら箱の下辺(足元)に当てる
function snaplines(
  regions: BlobRegion[],
  origin: Settings['lines']['origin'],
  W: number,
  H: number,
): [Point, Point][] {
  return regions.map((r) => {
    if (origin === 'top') return [{ x: W / 2, y: 0 }, { x: r.cx, y: r.y }]
    if (origin === 'center') return [{ x: W / 2, y: H / 2 }, { x: r.cx, y: r.cy }]
    return [{ x: W / 2, y: H }, { x: r.cx, y: r.y + r.h }]
  })
}

function chain(regions: BlobRegion[]): [BlobRegion, BlobRegion][] {
  const rest = regions.slice(1)
  const pairs: [BlobRegion, BlobRegion][] = []
  let current = regions[0]!
  while (rest.length) {
    let best = 0
    for (let i = 1; i < rest.length; i++) {
      if (dist2(current, rest[i]!) < dist2(current, rest[best]!)) best = i
    }
    const next = rest.splice(best, 1)[0]!
    pairs.push([current, next])
    current = next
  }
  return pairs
}

function nearest(regions: BlobRegion[], k: number): [BlobRegion, BlobRegion][] {
  const seen = new Set<string>()
  const pairs: [BlobRegion, BlobRegion][] = []
  for (const a of regions) {
    const others = regions.filter((b) => b !== a).sort((p, q) => dist2(a, p) - dist2(a, q))
    for (const b of others.slice(0, k)) {
      // A->B と B->A を二重に描かない
      const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push([a, b])
    }
  }
  return pairs
}

function dist2(a: BlobRegion, b: BlobRegion): number {
  return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2
}
