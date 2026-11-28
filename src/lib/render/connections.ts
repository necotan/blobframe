import type { Settings } from '../settings'
import type { BlobRegion } from '../types'

export type Point = { x: number; y: number }

/** 線の両端と、それぞれの端の箱。fromBox が null の端は画像の端で、箱の枠では切らない */
export type Segment = { from: Point; to: Point; fromBox: BlobRegion | null; toBox: BlobRegion }

/**
 * 描く線を返す。from -> to が矢印の向きになる。
 * `chain` は regions[0] を起点にするので、検出結果の並び(面積の大きい順)のまま渡すこと。
 */
export function connectionSegments(
  regions: BlobRegion[],
  s: Settings['lines'],
  imageWidth: number,
  imageHeight: number,
): Segment[] {
  if (s.rule === 'snapline') return snaplines(regions, s.origin, imageWidth, imageHeight)
  const u = Math.max(imageWidth, imageHeight) / 1000
  return connectionPairs(regions, s, u).map(([a, b]) => ({
    from: { x: a.cx, y: a.cy },
    to: { x: b.cx, y: b.cy },
    fromBox: a,
    toBox: b,
  }))
}

function connectionPairs(regions: BlobRegion[], s: Settings['lines'], u: number): [BlobRegion, BlobRegion][] {
  if (regions.length < 2) return []
  if (s.rule === 'chain') return chain(regions)
  if (s.rule === 'nearest') return nearest(regions, Math.max(1, Math.round(s.neighbors)))
  if (s.rule === 'mst') return mst(regions)
  if (s.rule === 'delaunay') return delaunay(regions)
  if (s.rule === 'radius') return withinRadius(regions, Math.max(0, s.radius) * u)
  return []
}

// ゲームの ESP 表示のように、画面の端から各箱へ1本ずつ引く。下からなら箱の下辺(足元)に当てる
function snaplines(
  regions: BlobRegion[],
  origin: Settings['lines']['origin'],
  W: number,
  H: number,
): Segment[] {
  return regions.map((r) => {
    if (origin === 'top') return { from: { x: W / 2, y: 0 }, to: { x: r.cx, y: r.y }, fromBox: null, toBox: r }
    if (origin === 'center') return { from: { x: W / 2, y: H / 2 }, to: { x: r.cx, y: r.cy }, fromBox: null, toBox: r }
    return { from: { x: W / 2, y: H }, to: { x: r.cx, y: r.y + r.h }, fromBox: null, toBox: r }
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
      const key = edgeKey(a.id, b.id)
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push([a, b])
    }
  }
  return pairs
}

// Prim 法で全体を最短の線の木にする。nearest と違い、線が途切れて島に分かれない
function mst(regions: BlobRegion[]): [BlobRegion, BlobRegion][] {
  const n = regions.length
  const inTree = new Array<boolean>(n).fill(false)
  const best = new Array<number>(n).fill(Infinity)
  const from = new Array<number>(n).fill(0)
  const pairs: [BlobRegion, BlobRegion][] = []
  best[0] = 0
  for (let step = 0; step < n; step++) {
    let next = -1
    for (let i = 0; i < n; i++) if (!inTree[i] && (next < 0 || best[i]! < best[next]!)) next = i
    inTree[next] = true
    if (step > 0) pairs.push([regions[from[next]!]!, regions[next]!])
    for (let i = 0; i < n; i++) {
      if (inTree[i]) continue
      const d = dist2(regions[next]!, regions[i]!)
      if (d < best[i]!) {
        best[i] = d
        from[i] = next
      }
    }
  }
  return pairs
}

function withinRadius(regions: BlobRegion[], radius: number): [BlobRegion, BlobRegion][] {
  const limit = radius * radius
  const pairs: [BlobRegion, BlobRegion][] = []
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      if (dist2(regions[i]!, regions[j]!) <= limit) pairs.push([regions[i]!, regions[j]!])
    }
  }
  return pairs
}

type Triangle = { a: number; b: number; c: number; contains: (p: Point) => boolean }

// 全体を囲む三角形の頂点は、無限に遠い3方向の点として扱う。有限の大きさで置くと、凸包の近くの細い三角形を取りこぼす。
// 向きを 1 ラジアンずらすのは、格子状に並んだ点の辺と平行になって左右を決められなくなるのを避けるため
const FAR: Point[] = [0, 1, 2].map((k) => ({ x: Math.cos(1 + (k * 2 * Math.PI) / 3), y: Math.sin(1 + (k * 2 * Math.PI) / 3) }))

// Bowyer-Watson 法。箱は多くても数百個なので、空間分割をしない O(n^2) で足りる
function delaunay(regions: BlobRegion[]): [BlobRegion, BlobRegion][] {
  // 同じ位置の箱どうしの線は長さ0で見えず、同じ点が2つあると三角形が作れないので1つにまとめる
  const unique = [...new Map(regions.map((r) => [`${r.cx},${r.cy}`, r])).values()]
  const n = unique.length
  const xs = unique.map((r) => r.cx)
  const ys = unique.map((r) => r.cy)
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  // 格子状に並ぶ quadtree の中心のように4点以上が同じ円の上にあると、丸め誤差で内外の判定が三角形ごとに食い違い、辺が交差する。
  // 見た目に出ないごく小さな量だけ、添字から決まる向きに点をずらしてその並びを崩す。線は元の中心に描く
  const jitter = size * 1e-7
  const pts: Point[] = unique.map((r, i) => ({ x: r.cx + jitter * noise(i, 1), y: r.cy + jitter * noise(i, 2) }))
  let triangles = [triangle(pts, n, n + 1, n + 2)]

  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const kept: Triangle[] = []
    const edges = new Map<string, [number, number] | null>()
    for (const t of triangles) {
      if (!t.contains(p)) {
        kept.push(t)
        continue
      }
      // 外接円に点が入る三角形どうしで共有する辺は穴の内側なので捨て、穴の外周の辺だけを新しい点とつなぐ
      for (const [v, w] of triangleEdges(t)) {
        const key = edgeKey(v, w)
        edges.set(key, edges.has(key) ? null : [v, w])
      }
    }
    for (const e of edges.values()) if (e) kept.push(triangle(pts, e[0], e[1], i))
    triangles = kept
  }

  const seen = new Set<string>()
  const pairs: [BlobRegion, BlobRegion][] = []
  for (const t of triangles) {
    for (const [v, w] of triangleEdges(t)) {
      const key = edgeKey(v, w)
      if (v >= n || w >= n || seen.has(key)) continue
      seen.add(key)
      // ずらす前に一直線に並んでいた点どうしは、間の点を飛ばす細い三角形の辺でもつながる。線が重なるだけなので描かない
      if (unique.some((r) => r !== unique[v] && r !== unique[w] && onSegment(r, unique[v]!, unique[w]!, jitter * 10))) continue
      // 向きのない線なので、矢印が大きい箱から小さい箱へ向くよう、面積順に振った id でそろえる
      const [p, q] = [unique[v]!, unique[w]!]
      pairs.push(p.id < q.id ? [p, q] : [q, p])
    }
  }
  return pairs
}

function onSegment(p: BlobRegion, a: BlobRegion, b: BlobRegion, tolerance: number): boolean {
  const dx = b.cx - a.cx
  const dy = b.cy - a.cy
  const len2 = dx * dx + dy * dy
  const t = ((p.cx - a.cx) * dx + (p.cy - a.cy) * dy) / len2
  if (t <= 0 || t >= 1) return false
  return Math.hypot(a.cx + t * dx - p.cx, a.cy + t * dy - p.cy) <= tolerance
}

// -0.5 から 0.5。描くたびに同じ値になるよう、乱数ではなく添字から決める
function noise(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return v - Math.floor(v) - 0.5
}

function triangleEdges(t: Triangle): [number, number][] {
  return [
    [t.a, t.b],
    [t.b, t.c],
    [t.c, t.a],
  ]
}

function edgeKey(v: number, w: number): string {
  return v < w ? `${v}-${w}` : `${w}-${v}`
}

// 添字が pts.length 以上の頂点は、FAR の向きに無限に遠い点として扱う
function triangle(pts: Point[], a: number, b: number, c: number): Triangle {
  const real = [a, b, c].filter((v) => v < pts.length).map((v) => pts[v]!)
  const far = [a, b, c].filter((v) => v >= pts.length).map((v) => FAR[v - pts.length]!)
  return { a, b, c, contains: circleTest(real, far) }
}

function circleTest(real: Point[], far: Point[]): (p: Point) => boolean {
  if (far.length === 3) return () => true
  if (far.length === 2) {
    // 1点と無限に遠い2点を通る円は、その点を通り、2つの向きの間を向いた半平面になる
    const A = real[0]!
    const dx = far[0]!.x + far[1]!.x
    const dy = far[0]!.y + far[1]!.y
    return (p) => (p.x - A.x) * dx + (p.y - A.y) * dy > 0
  }
  if (far.length === 1) {
    // 2点と無限に遠い1点を通る円は、2点を結ぶ直線で分けた遠い点の側の半平面になる。直線上では2点の間だけが内側
    const [A, B] = real as [Point, Point]
    const side = cross(A, B, { x: A.x + far[0]!.x, y: A.y + far[0]!.y })
    return (p) => {
      const c = cross(A, B, p)
      if (c === 0) return (p.x - A.x) * (p.x - B.x) + (p.y - A.y) * (p.y - B.y) < 0
      return c > 0 === side > 0
    }
  }
  const [A, B, C] = real as [Point, Point, Point]
  const orient = cross(A, B, C)
  // 3点が一直線に並ぶと外接円が無限に大きくなる。どの点も内側に入るとみなし、次の点を足すときに作り直させる
  if (orient === 0) return () => true
  // 外接円の中心を求めてから距離を比べるより、調べる点を原点にした行列式のほうが丸め誤差が小さい
  return (p) => {
    const adx = A.x - p.x
    const ady = A.y - p.y
    const bdx = B.x - p.x
    const bdy = B.y - p.y
    const cdx = C.x - p.x
    const cdy = C.y - p.y
    const det =
      (adx * adx + ady * ady) * (bdx * cdy - cdx * bdy) +
      (bdx * bdx + bdy * bdy) * (cdx * ady - adx * cdy) +
      (cdx * cdx + cdy * cdy) * (adx * bdy - bdx * ady)
    return orient > 0 ? det > 0 : det < 0
  }
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function dist2(a: BlobRegion, b: BlobRegion): number {
  return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2
}
