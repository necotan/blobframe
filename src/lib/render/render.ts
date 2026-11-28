import type { Settings } from '../settings'
import type { BlobRegion } from '../types'
import { monoFontFamily } from '../fonts'
import { connectionSegments } from './connections'
import { formatLabel } from './label'

type Source = CanvasImageSource & { width: number; height: number }

/**
 * source に検出結果を重ねて ctx に描く。ctx の canvas は source と同じサイズにしておくこと。
 * 線幅や文字サイズの設定値は「長辺1000pxの画像での px」として扱い、画像サイズに比例させる。
 */
export function render(ctx: CanvasRenderingContext2D, source: Source, regions: BlobRegion[], s: Settings) {
  const W = source.width
  const H = source.height
  const u = Math.max(W, H) / 1000

  ctx.save()
  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(source, 0, 0)

  if (s.background.mono) desaturate(ctx, 0, 0, W, H)
  if (s.background.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${s.background.dim})`
    ctx.fillRect(0, 0, W, H)
  }

  const backgroundChanged = s.background.mono || s.background.dim > 0
  for (const r of regions) drawEffects(ctx, source, r, s, u, backgroundChanged)
  for (const r of regions) drawFill(ctx, r, s.fill, u)
  drawConnections(ctx, regions, s.lines, u, W, H)
  if (s.stroke.enabled) for (const r of regions) drawStroke(ctx, r, s.stroke, u)
  for (const r of regions) drawMarker(ctx, r, s.marker, u)
  if (s.label.enabled) drawLabels(ctx, regions, s.label, u, W, H)
  ctx.restore()
}

function clipRect(ctx: CanvasRenderingContext2D, r: BlobRegion) {
  ctx.beginPath()
  ctx.rect(r.x, r.y, r.w, r.h)
  ctx.clip()
}

// ctx.filter はブラウザ間で対応差があるため使わず、合成モードで代用する。
// 'saturation' で彩度0のグレーを重ねると、下地の色相と輝度を保ったまま彩度だけ0になる
function desaturate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'saturation'
  ctx.fillStyle = '#808080'
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

// 'color' は下地の明るさを残して色相と彩度だけを塗った色にするので、写真の陰影を保ったまま色が付く
function colorize(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, amount: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'color'
  ctx.globalAlpha = amount
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

// 白と 'difference' で合成すると 255 - 下地 になり、色反転と同じ結果になる
function invert(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'difference'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

// モザイクとぼかしで縮小した画像を置く作業用の canvas。箱ごとに要素を作らないよう使い回す
let scratch: HTMLCanvasElement | null = null

function drawEffects(
  ctx: CanvasRenderingContext2D,
  source: Source,
  r: BlobRegion,
  s: Settings,
  u: number,
  backgroundChanged: boolean,
) {
  const { zoom, mono, invert: inv, blur, mosaic, tint, tintColor } = s.effect
  const cell = (mosaic > 0 ? mosaic : blur) * u
  if (!backgroundChanged && zoom <= 1 && cell <= 0 && !mono && tint <= 0 && !inv) return
  ctx.save()
  clipRect(ctx, r)
  // 背景を暗く/モノクロにした分も、箱の中は元画像から描き直す
  const z = Math.max(1, zoom)
  const sw = r.w / z
  const sh = r.h / z
  const sx = r.cx - sw / 2
  const sy = r.cy - sh / 2
  if (cell > 0) {
    // 画素を1つずつ処理せず、縮めてから引き伸ばす。補間なしで引き伸ばすとモザイク、補間ありだとぼかしになる。
    // マス目は画像全体の格子にそろえ、重なった箱どうしでずれないようにする。はみ出した分は clip で切れる
    const x0 = Math.floor(r.x / cell) * cell
    const y0 = Math.floor(r.y / cell) * cell
    const w = Math.max(1, Math.ceil((r.x + r.w - x0) / cell))
    const h = Math.max(1, Math.ceil((r.y + r.h - y0) / cell))
    // 大きさを毎回合わせる。前の箱の画素が残ると、ぼかしの補間で端に混ざる
    scratch ??= document.createElement('canvas')
    scratch.width = w
    scratch.height = h
    const sctx = scratch.getContext('2d')!
    sctx.imageSmoothingQuality = 'high'
    // 格子にそろえて広げた範囲に対応する元画像の範囲。ズーム中は箱の中心を基準に 1/zoom に縮める
    sctx.drawImage(source, sx + (x0 - r.x) / z, sy + (y0 - r.y) / z, (w * cell) / z, (h * cell) / z, 0, 0, w, h)
    ctx.imageSmoothingEnabled = mosaic <= 0
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(scratch, x0, y0, w * cell, h * cell)
  } else if (zoom > 1 || backgroundChanged) {
    ctx.drawImage(source, sx, sy, sw, sh, r.x, r.y, r.w, r.h)
  }
  if (mono) desaturate(ctx, r.x, r.y, r.w, r.h)
  if (tint > 0) colorize(ctx, r.x, r.y, r.w, r.h, tintColor, tint)
  if (inv) invert(ctx, r.x, r.y, r.w, r.h)
  ctx.restore()
}

function drawFill(ctx: CanvasRenderingContext2D, r: BlobRegion, s: Settings['fill'], u: number) {
  if (s.mode === 'none' || s.opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = s.opacity
  if (s.mode === 'solid') {
    ctx.fillStyle = s.color
    ctx.fillRect(r.x, r.y, r.w, r.h)
  } else {
    clipRect(ctx, r)
    const step = Math.max(1, s.meshSpacing * u)
    ctx.beginPath()
    for (let x = r.x; x <= r.x + r.w; x += step) {
      ctx.moveTo(x, r.y)
      ctx.lineTo(x, r.y + r.h)
    }
    for (let y = r.y; y <= r.y + r.h; y += step) {
      ctx.moveTo(r.x, y)
      ctx.lineTo(r.x + r.w, y)
    }
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.meshWidth * u
    ctx.stroke()
  }
  ctx.restore()
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  regions: BlobRegion[],
  s: Settings['lines'],
  u: number,
  W: number,
  H: number,
) {
  const segments = connectionSegments(regions, s, W, H)
  if (!segments.length) return
  ctx.save()
  ctx.globalAlpha = s.opacity
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.width * u
  ctx.setLineDash(s.dashed ? [4 * u, 4 * u] : [])
  ctx.beginPath()
  for (const [a, b] of segments) {
    ctx.moveTo(a.x, a.y)
    if (s.shape === 'curve') {
      // 中点から線分に垂直な方向へずらした点を制御点にする。curvature は線分の長さに対する比率
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const dx = b.x - a.x
      const dy = b.y - a.y
      ctx.quadraticCurveTo(mx - dy * s.curvature, my + dx * s.curvature, b.x, b.y)
    } else {
      ctx.lineTo(b.x, b.y)
    }
  }
  ctx.stroke()
  ctx.restore()
}

function drawStroke(ctx: CanvasRenderingContext2D, r: BlobRegion, s: Settings['stroke'], u: number) {
  ctx.save()
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.width * u
  if (s.style === 'corners') {
    const len = Math.min(r.w, r.h) * 0.25
    const { x, y, w, h } = r
    ctx.beginPath()
    for (const [px, py, dx, dy] of [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ] as const) {
      ctx.moveTo(px + dx * len, py)
      ctx.lineTo(px, py)
      ctx.lineTo(px, py + dy * len)
    }
    ctx.stroke()
  } else {
    ctx.setLineDash(s.style === 'dashed' ? [4 * u, 3 * u] : [])
    ctx.strokeRect(r.x, r.y, r.w, r.h)
  }
  ctx.restore()
}

function drawMarker(ctx: CanvasRenderingContext2D, r: BlobRegion, s: Settings['marker'], u: number) {
  if (s.shape === 'none') return
  const size = (s.size * u) / 2
  ctx.save()
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = Math.max(1, u)
  ctx.beginPath()
  if (s.shape === 'cross') {
    ctx.moveTo(r.cx - size, r.cy)
    ctx.lineTo(r.cx + size, r.cy)
    ctx.moveTo(r.cx, r.cy - size)
    ctx.lineTo(r.cx, r.cy + size)
    ctx.stroke()
  } else if (s.shape === 'dot') {
    ctx.arc(r.cx, r.cy, size / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.arc(r.cx, r.cy, size, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

type Rect = { x: number; y: number; w: number; h: number }

function drawLabels(ctx: CanvasRenderingContext2D, regions: BlobRegion[], s: Settings['label'], u: number, W: number, H: number) {
  const fontSize = s.size * u
  const pad = fontSize * 0.2
  const h = fontSize + pad * 2
  // 保存データの overlap は値を確かめていないので、未知の値は今までどおり重ねて描く
  const avoid = s.overlap === 'move' || s.overlap === 'hide'
  ctx.save()
  ctx.font = `${fontSize}px ${monoFontFamily()}`
  ctx.textBaseline = 'top'
  // regions は面積の大きい順なので、先に置く大きい箱のラベルほど指定の位置に残る
  const placed: Rect[] = []
  for (const r of regions) {
    const text = formatLabel(s.template, r, W, H, s.coordScale)
    if (!text) continue
    const w = ctx.measureText(text).width + pad * 2
    const candidates = labelCandidates(r, s.position, w, h, W, H, avoid)
    const free = candidates.find((c) => !placed.some((p) => intersects(p, c)))
    const rect = free ?? (s.overlap === 'hide' ? null : candidates[0]!)
    if (!rect) continue
    placed.push(rect)
    if (s.background) {
      ctx.fillStyle = s.backgroundColor
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }
    ctx.fillStyle = s.color
    ctx.fillText(text, rect.x + pad, rect.y + pad)
  }
  ctx.restore()
}

/** 先頭が指定の位置。avoid のときは、重なったときに順に試す箱の上下、右寄せ、内側の位置を後ろに足す。 */
function labelCandidates(
  r: BlobRegion,
  position: Settings['label']['position'],
  w: number,
  h: number,
  W: number,
  H: number,
  avoid: boolean,
): Rect[] {
  let x = r.x
  let y = r.y - h
  if (position === 'inside' || (position === 'top-left' && y < 0)) y = r.y
  else if (position === 'center') {
    x = r.cx - w / 2
    y = r.cy - h / 2
  } else if (position === 'bottom-left') y = r.y + r.h
  const points = [[x, y]]
  if (avoid) {
    const right = r.x + r.w - w
    const bottom = r.y + r.h
    points.push(
      [r.x, r.y - h],
      [r.x, bottom],
      [right, r.y - h],
      [right, bottom],
      [r.x, r.y],
      [right, r.y],
      [r.x, bottom - h],
      [right, bottom - h],
    )
  }
  // 画像の外にはみ出すと書き出し時に切れるので内側へ寄せる
  return points.map(([px, py]) => ({
    x: Math.min(Math.max(0, px!), W - w),
    y: Math.min(Math.max(0, py!), H - h),
    w,
    h,
  }))
}

// 辺が接しているだけなら重なりとみなさない
function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}
