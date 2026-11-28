// iOS Safari の canvas は上限を超えると何も描かれない。上限は iOS 17 までは 4096x4096、iOS 18 からは 8192x8192 と報告されている。
// この画素数以下はどの端末でも描けるので確かめず、超えるときだけ実際に描けるかを試す
const SAFE_CANVAS_PIXELS = 4096 * 4096

export type LoadedImage = {
  bitmap: ImageBitmap
  /** 端末の canvas に収まらず縮小したときの元の大きさ。縮小していなければ null */
  original: { width: number; height: number } | null
}

/** 画像を読み込み、この端末の canvas に描けない大きさなら描ける大きさまで縮める。 */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  if (width * height <= SAFE_CANVAS_PIXELS || canvasFits(width, height)) return { bitmap, original: null }

  const scale = Math.sqrt(SAFE_CANVAS_PIXELS / (width * height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(width * scale)
  canvas.height = Math.floor(height * scale)
  const ctx = canvas.getContext('2d')
  // iOS は canvas 全体のメモリ上限を超えると null を返す。例外にして読み込み失敗として表示させる
  if (!ctx) throw new Error('canvas memory limit')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const resized = await createImageBitmap(canvas)
  canvas.width = canvas.height = 0
  return { bitmap: resized, original: { width, height } }
}

// 上限を超えた canvas は例外を出さずに空のまま描画を無視するので、右下の1画素を描いて読み戻せるかで確かめる
function canvasFits(width: number, height: number): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  let fits = false
  if (ctx) {
    ctx.fillRect(width - 1, height - 1, 1, 1)
    fits = ctx.getImageData(width - 1, height - 1, 1, 1).data[3] !== 0
  }
  // 確かめるためだけに確保した大きなメモリをすぐ手放す
  canvas.width = canvas.height = 0
  return fits
}
