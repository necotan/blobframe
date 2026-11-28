import type { BlobRegion } from '../types'
import type { Point, Segment } from './connections'

/** 直線(control が null)か2次ベジェ曲線 */
export type Curve = { start: Point; control: Point | null; end: Point }

type Inside = (p: Point) => boolean

/**
 * seg の両端を切った線を返す。edge なら箱を gap(px) だけ広げた枠の外へ出たところ、そうでなければ端点から gap 離れたところで切る。
 * 箱が重なっているか近すぎて何も残らないときは null。
 */
export function trimLine(seg: Segment, control: Point | null, edge: boolean, gap: number): Curve | null {
  const curve = { start: seg.from, control, end: seg.to }
  return cut(curve, seg.fromBox && insideTest(seg.from, seg.fromBox, edge, gap), insideTest(seg.to, seg.toBox, edge, gap))
}

/** curve の両端から、それぞれ直線距離で from、to(px) だけ手前で止めた線を返す。何も残らないときは null */
export function shorten(curve: Curve, from: number, to: number): Curve | null {
  return cut(curve, from > 0 ? within(curve.start, from) : null, to > 0 ? within(curve.end, to) : null)
}

/** curve の端での、線の外へ向かう単位ベクトル */
export function outward(curve: Curve, side: 'start' | 'end'): Point {
  const [p, q, other] = side === 'start' ? [curve.start, curve.control, curve.end] : [curve.end, curve.control, curve.start]
  // 制御点が端点と重なると接線が決まらないので、両端を結ぶ向きを使う
  const from = q && (q.x !== p.x || q.y !== p.y) ? q : other
  const dx = p.x - from.x
  const dy = p.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

function cut(curve: Curve, insideStart: Inside | null, insideEnd: Inside | null): Curve | null {
  const t0 = insideStart ? boundary(curve, insideStart, 0, 1) : 0
  const t1 = insideEnd ? boundary(curve, insideEnd, 1, 0) : 1
  return t0 < t1 ? subCurve(curve, t0, t1) : null
}

function insideTest(target: Point, box: BlobRegion, edge: boolean, gap: number): Inside | null {
  if (edge) {
    // snapline の箱側の端は箱の辺の上にあるので、辺の上も内側に数えて gap の分だけ手前で止める
    return (p) => p.x >= box.x - gap && p.x <= box.x + box.w + gap && p.y >= box.y - gap && p.y <= box.y + box.h + gap
  }
  return gap > 0 ? within(target, gap) : null
}

function within(center: Point, radius: number): Inside {
  return (p) => (p.x - center.x) ** 2 + (p.y - center.y) ** 2 < radius * radius
}

// t = from が inside、t = to が外のとき、その境目の t を二分法で求める。長方形と円は凸なので、直線なら境目は1つに決まる。
// 曲線は極端に曲げたときだけ複数回出入りし得るが、見つかった1つで切っても見た目はほぼ変わらない
function boundary(curve: Curve, inside: Inside, from: number, to: number): number {
  if (!inside(pointAt(curve, from))) return from
  if (inside(pointAt(curve, to))) return to
  let a = from
  let b = to
  // 30回で線の長さの 1/10億まで詰まり、どんな画像でも1px未満になる
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2
    if (inside(pointAt(curve, m))) a = m
    else b = m
  }
  return b
}

function pointAt(c: Curve, t: number): Point {
  const m = 1 - t
  if (!c.control) return { x: m * c.start.x + t * c.end.x, y: m * c.start.y + t * c.end.y }
  return {
    x: m * m * c.start.x + 2 * m * t * c.control.x + t * t * c.end.x,
    y: m * m * c.start.y + 2 * m * t * c.control.y + t * t * c.end.y,
  }
}

// 2次ベジェ曲線の t0..t1 の部分も2次ベジェ曲線で、制御点は blossom f(t0, t1) になる
function subCurve(c: Curve, t0: number, t1: number): Curve {
  const start = pointAt(c, t0)
  const end = pointAt(c, t1)
  if (!c.control) return { start, control: null, end }
  const a = (1 - t0) * (1 - t1)
  const b = (1 - t0) * t1 + t0 * (1 - t1)
  const d = t0 * t1
  const control = {
    x: a * c.start.x + b * c.control.x + d * c.end.x,
    y: a * c.start.y + b * c.control.y + d * c.end.y,
  }
  return { start, control, end }
}
