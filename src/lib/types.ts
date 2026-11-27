/**
 * 検出された領域。座標はすべて元画像のピクセル単位。
 * DOM の Blob と名前が衝突するため BlobRegion と呼ぶ。
 */
export type BlobRegion = {
  id: number
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
  /** 領域内の画素数(元画像換算)。外接矩形の面積ではない */
  area: number
  /** 0-255 */
  luminance: number
}
