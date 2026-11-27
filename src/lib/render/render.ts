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
  for (const r of regions) drawEffects(ctx, source, r, s, backgroundChanged)
  for (const r of regions) drawFill(ctx, r, s.fill, u)
  drawConnections(ctx, regions, s.lines, u, W, H)
  if (s.stroke.enabled) for (const r of regions) drawStroke(ctx, r, s.stroke, u)
  for (const r of regions) drawMarker(ctx, r, s.marker, u)
  if (s.label.enabled) {
    const fontFamily = monoFontFamily()
    for (const r of regions) drawLabel(ctx, r, s.label, u, W, H, fontFamily)
  }
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

// 白と 'difference' で合成すると 255 - 下地 になり、色反転と同じ結果になる
function invert(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'difference'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  source: Source,
  r: BlobRegion,
  s: Settings,
  backgroundChanged: boolean,
) {
  const { zoom, mono, invert: inv } = s.effect
  if (!backgroundChanged && zoom <= 1 && !mono && !inv) return
  ctx.save()
  clipRect(ctx, r)
  if (zoom > 1) {
    const sw = r.w / zoom
    const sh = r.h / zoom
    ctx.drawImage(source, r.cx - sw / 2, r.cy - sh / 2, sw, sh, r.x, r.y, r.w, r.h)
  } else if (backgroundChanged) {
    // 背景を暗く/モノクロにした分を、箱の中だけ元画像に戻す
    ctx.drawImage(source, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h)
  }
  if (mono) desaturate(ctx, r.x, r.y, r.w, r.h)
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

function drawLabel(
  ctx: CanvasRenderingContext2D,
  r: BlobRegion,
  s: Settings['label'],
  u: number,
  W: number,
  H: number,
  fontFamily: string,
) {
  const text = formatLabel(s.template, r, W, H, s.coordScale)
  if (!text) return
  const fontSize = s.size * u
  const pad = fontSize * 0.2
  ctx.save()
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'top'
  const boxW = ctx.measureText(text).width + pad * 2
  const boxH = fontSize + pad * 2

  let x = r.x
  let y = r.y - boxH
  if (s.position === 'inside' || (s.position === 'top-left' && y < 0)) y = r.y
  else if (s.position === 'center') {
    x = r.cx - boxW / 2
    y = r.cy - boxH / 2
  } else if (s.position === 'bottom-left') y = r.y + r.h
  // 画像の外にはみ出すと書き出し時に切れるので内側へ寄せる
  x = Math.min(Math.max(0, x), W - boxW)
  y = Math.min(Math.max(0, y), H - boxH)

  if (s.background) {
    ctx.fillStyle = s.backgroundColor
    ctx.fillRect(x, y, boxW, boxH)
  }
  ctx.fillStyle = s.color
  ctx.fillText(text, x + pad, y + pad)
  ctx.restore()
}
