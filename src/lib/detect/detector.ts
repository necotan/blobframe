import type { DetectSettings } from '../settings'
import type { BlobRegion } from '../types'
import type { DetectRequest, DetectResponse } from './detect.worker'

/**
 * Worker 上で検出を行う。連続で呼ぶと古い要求の結果は捨て、最後の要求の結果だけを resolve する。
 * 捨てられた呼び出しの Promise は resolve されないまま残る。
 */
export function createDetector() {
  const worker = new Worker(new URL('./detect.worker.ts', import.meta.url), { type: 'module' })
  let latest = 0
  const pending = new Map<number, (regions: BlobRegion[]) => void>()

  worker.onmessage = (e: MessageEvent<DetectResponse>) => {
    const resolve = pending.get(e.data.requestId)
    pending.delete(e.data.requestId)
    if (resolve && e.data.requestId === latest) resolve(e.data.regions)
  }

  return {
    detect(source: CanvasImageSource & { width: number; height: number }, settings: DetectSettings) {
      const scale = Math.min(1, settings.processSize / Math.max(source.width, source.height))
      const w = Math.max(1, Math.round(source.width * scale))
      const h = Math.max(1, Math.round(source.height * scale))
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      // 縮小時の補間で細かいノイズが平均化され、検出が安定する
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(source, 0, 0, w, h)
      const pixels = ctx.getImageData(0, 0, w, h)

      const requestId = ++latest
      const request: DetectRequest = { requestId, pixels, srcWidth: source.width, srcHeight: source.height, settings }
      return new Promise<BlobRegion[]>((resolve) => {
        pending.set(requestId, resolve)
        worker.postMessage(request, [pixels.data.buffer])
      })
    },
    dispose() {
      worker.terminate()
      pending.clear()
    },
  }
}
