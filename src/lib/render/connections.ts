import type { Settings } from '../settings'
import type { BlobRegion } from '../types'

/**
 * 線でつなぐ領域の組を返す。`chain` は regions[0] を起点にするので、検出結果の並び(面積の大きい順)のまま渡すこと。
 */
export function connectionPairs(regions: BlobRegion[], s: Settings['lines']): [BlobRegion, BlobRegion][] {
  if (regions.length < 2) return []
  if (s.rule === 'chain') return chain(regions)
  if (s.rule === 'nearest') return nearest(regions, Math.max(1, Math.round(s.neighbors)))
  return []
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
