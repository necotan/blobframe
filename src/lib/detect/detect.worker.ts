import type { DetectSettings } from '../settings'
import type { BlobRegion } from '../types'
import { detectThreshold, toGray } from './threshold'

export type DetectRequest = {
  requestId: number
  pixels: ImageData
  srcWidth: number
  srcHeight: number
  settings: DetectSettings
}

export type DetectResponse = { requestId: number; regions: BlobRegion[] }

self.onmessage = (e: MessageEvent<DetectRequest>) => {
  const { requestId, pixels, srcWidth, srcHeight, settings } = e.data
  const gray = toGray(pixels.data, pixels.width, pixels.height)
  const scale = srcWidth / pixels.width
  const regions = detectThreshold(gray, scale, srcWidth, srcHeight, settings)
  self.postMessage({ requestId, regions } satisfies DetectResponse)
}
