import type { DetectSettings } from '../settings'
import type { BlobRegion } from '../types'
import { toGray } from './common'
import { detectQuadtree } from './quadtree'
import { detectThreshold } from './threshold'

export type DetectRequest = {
  requestId: number
  pixels: ImageData
  srcWidth: number
  srcHeight: number
  settings: DetectSettings
}

export type DetectResponse = { requestId: number; regions: BlobRegion[] }

const methods: Record<DetectSettings['method'], typeof detectThreshold> = {
  threshold: detectThreshold,
  quadtree: detectQuadtree,
}

self.onmessage = (e: MessageEvent<DetectRequest>) => {
  const { requestId, pixels, srcWidth, srcHeight, settings } = e.data
  const gray = toGray(pixels.data, pixels.width, pixels.height)
  const src = { scale: srcWidth / pixels.width, width: srcWidth, height: srcHeight }
  // 保存データの method は許可された値か確かめていないので、未知の値は threshold として扱う
  const detect = methods[settings.method] ?? detectThreshold
  self.postMessage({ requestId, regions: detect(gray, src, settings) } satisfies DetectResponse)
}
