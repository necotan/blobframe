import type { DetectSettings } from '../settings'
import type { BlobRegion } from '../types'
import { boxBlur, pickRegions, toRegion, type GrayImage, type SourceFrame } from './common'

// 分割しきれなかった平らなセルまで返すと画像全体が箱で埋まるので、
// 分割の基準の半分以上の細かさがあるセルだけを残し、細部の周りに大小の箱が集まるようにする
const KEEP_RATIO = 0.5

/**
 * 細かい(明るさのばらつきが大きい)部分ほど小さく分割する四分木で領域を検出し、面積の大きい順に返す。
 * minSize は分割の下限も兼ねるので、細部が minSize より小さい箱で抜け落ちることはない。
 */
export function detectQuadtree(gray: GrayImage, src: SourceFrame, s: DetectSettings): BlobRegion[] {
  const img = boxBlur(gray, s.blur)
  const { sum, sumSq } = integralImages(img)
  const stride = img.width + 1
  const rect = (table: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    table[y1 * stride + x1]! - table[y0 * stride + x1]! - table[y1 * stride + x0]! + table[y0 * stride + x0]!

  const maxDepth = Math.max(1, Math.round(s.quadDepth))
  const candidates: BlobRegion[] = []
  const stack = [{ x0: 0, y0: 0, x1: img.width, y1: img.height, depth: 0 }]
  while (stack.length) {
    const { x0, y0, x1, y1, depth } = stack.pop()!
    const n = (x1 - x0) * (y1 - y0)
    const mean = rect(sum, x0, y0, x1, y1) / n
    // 浮動小数の誤差で負になることがある
    const detail = Math.sqrt(Math.max(0, rect(sumSq, x0, y0, x1, y1) / n - mean * mean))

    const mx = (x0 + x1) >> 1
    const my = (y0 + y1) >> 1
    const childSide = Math.min(mx - x0, my - y0) * src.scale
    const canSplit = depth < maxDepth && mx > x0 && my > y0 && childSide >= s.minSize
    if (detail > s.quadDetail && canSplit) {
      const d = depth + 1
      stack.push(
        { x0, y0, x1: mx, y1: my, depth: d },
        { x0: mx, y0, x1, y1: my, depth: d },
        { x0, y0: my, x1: mx, y1, depth: d },
        { x0: mx, y0: my, x1, y1, depth: d },
      )
      continue
    }
    if (depth < s.quadMinDepth || detail < s.quadDetail * KEEP_RATIO) continue
    const region = toRegion(x0, y0, x1, y1, n, mean, src, s)
    if (region) candidates.push(region)
  }

  // セル同士は重ならないので、しきい値方式のような重複の統合はいらない。padding を足すと隣のセルと重なるので maxOverlap は効く
  return pickRegions(candidates, s)
}

// 任意の矩形の合計と二乗和を O(1) で求め、セルごとのばらつきを画素数に関係なく出せるようにする
function integralImages(img: GrayImage) {
  const { width: w, height: h } = img
  const stride = w + 1
  const sum = new Float64Array(stride * (h + 1))
  const sumSq = new Float64Array(stride * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    let rowSq = 0
    for (let x = 0; x < w; x++) {
      const v = img.data[y * w + x]!
      rowSum += v
      rowSq += v * v
      const i = (y + 1) * stride + x + 1
      sum[i] = sum[i - stride]! + rowSum
      sumSq[i] = sumSq[i - stride]! + rowSq
    }
  }
  return { sum, sumSq }
}
