import { useEffect, useLayoutEffect, useRef } from 'react'
import { Pane, type ButtonApi } from 'tweakpane'
import { downloadBlob, pickFile, timestamp } from '../lib/download'
import type { ExportSettings } from '../lib/exportSettings'
import { PRESETS, matchPreset } from '../lib/presets'
import { DEFAULT_SETTINGS, cloneSettings, mergeSettings, type Settings } from '../lib/settings'
import { DropdownPlugin } from './pane/dropdownPlugin'
import { replaceFolderMarks } from './pane/folderIcons'
import './pane/pane.css'

const CUSTOM = 'custom'
const EXPORT_TITLE = 'Export image'
const PRESET_OPTIONS = Object.fromEntries([...PRESETS.map((p) => [p.name, p.id]), ['Custom', CUSTOM]])

type Props = {
  /** パネル生成時の初期値。変わるとパネルを作り直すので、呼び出し側で固定した値を渡すこと */
  initial: Settings
  onChange: (settings: Settings) => void
  /** 書き出し設定の初期値。initial と同じく固定した値を渡すこと */
  initialExport: ExportSettings
  onExportChange: (settings: ExportSettings) => void
  onOpenImage: () => void
  /** 書き出しが終わるまでボタンを押せなくするので、終わったら解決する Promise を返すこと */
  onExportImage: () => Promise<void>
  canExport: boolean
}

export function ControlPane(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  const exportButtonRef = useRef<ButtonApi | null>(null)
  const exportingRef = useRef(false)

  // パネルは一度だけ作り、最新のコールバックは ref 経由で呼ぶ
  useLayoutEffect(() => {
    propsRef.current = props
    if (exportButtonRef.current) exportButtonRef.current.disabled = !props.canExport || exportingRef.current
  })

  useEffect(() => {
    const params = cloneSettings(props.initial)
    const pane = new Pane({ container: containerRef.current! })
    pane.registerPlugin({ id: 'blobframe', plugins: [DropdownPlugin] })
    const emit = () => propsRef.current.onChange(cloneSettings(params))

    // pane.refresh() は値の変わったバインディングごとに change を出すので、その間は個別の処理を止めて最後に1回だけ行う
    let replacing = false
    const replaceAll = (next: Settings) => {
      for (const group of Object.keys(params) as (keyof Settings)[]) Object.assign(params[group], next[group])
      replacing = true
      pane.refresh()
      replacing = false
      afterChange()
    }

    const exportParams = { ...props.initialExport }
    const file = pane.addFolder({ title: 'File' })
    file.addButton({ title: 'Open image' }).on('click', () => propsRef.current.onOpenImage())
    const format = file.addBinding(exportParams, 'format', { options: { PNG: 'png', JPEG: 'jpeg', WebP: 'webp' } })
    const quality = file.addBinding(exportParams, 'quality', { min: 0.5, max: 1, step: 0.01 })
    const scale = file.addBinding(exportParams, 'scale', { min: 0.1, max: 1, step: 0.05 })
    // 書き出しの設定は Settings に含めないので、パネル全体の change では扱わない
    const exportBindings = new Set<unknown>([format, quality, scale])
    for (const b of [format, quality, scale]) {
      b.on('change', () => {
        syncVisibility()
        propsRef.current.onExportChange({ ...exportParams })
      })
    }
    const exportButton = file.addButton({ title: EXPORT_TITLE })
    // 大きな画像の WebP は書き出しに数十秒かかるので、その間は押せなくして進行中と分かるようにする
    exportButton.on('click', async () => {
      exportingRef.current = true
      exportButton.disabled = true
      exportButton.title = 'Exporting...'
      try {
        await propsRef.current.onExportImage()
      } finally {
        exportingRef.current = false
        exportButton.title = EXPORT_TITLE
        exportButton.disabled = !propsRef.current.canExport
      }
    })
    exportButton.disabled = !propsRef.current.canExport
    exportButtonRef.current = exportButton

    // 一覧の表示は設定から導く。どのプリセットとも一致しなければ Custom
    const presetState = { preset: matchPreset(params) ?? CUSTOM }
    const presetFolder = pane.addFolder({ title: 'Preset' })
    const presetBinding = presetFolder.addBinding(presetState, 'preset', { options: PRESET_OPTIONS })
    presetBinding.on('change', (e) => {
      const preset = PRESETS.find((p) => p.id === e.value)
      // Custom を選んでも適用するものはないので、表示を設定に合わせ直す
      if (!preset) return syncPreset()
      // 一覧の表示を合わせるための書き換えでも change が来るので、すでに一致しているときは何もしない
      if (matchPreset(params) !== preset.id) replaceAll(preset.settings)
    })
    presetFolder.addButton({ title: 'Save file' }).on('click', () => {
      const json = JSON.stringify(params, null, 2)
      downloadBlob(new Blob([json], { type: 'application/json' }), `blobframe-preset-${timestamp()}.json`)
    })
    presetFolder.addButton({ title: 'Load file' }).on('click', async () => {
      const f = await pickFile('application/json,.json')
      if (!f) return
      try {
        replaceAll(mergeSettings(DEFAULT_SETTINGS, JSON.parse(await f.text())))
      } catch {
        // 壊れた JSON は読み込まずに今の設定を保つ
      }
    })

    const d = pane.addFolder({ title: 'Detect' })
    d.addBinding(params.detect, 'method', { options: { Threshold: 'threshold', Quadtree: 'quadtree' } })
    const thresholdBindings = [
      d.addBinding(params.detect, 'target', { options: { Bright: 'bright', Dark: 'dark' } }),
      d.addBinding(params.detect, 'thresholdMin', { label: 'threshold min', min: 0, max: 255, step: 1 }),
      d.addBinding(params.detect, 'thresholdMax', { label: 'threshold max', min: 0, max: 255, step: 1 }),
      d.addBinding(params.detect, 'levels', { min: 1, max: 8, step: 1 }),
    ]
    const quadtreeBindings = [
      d.addBinding(params.detect, 'quadDetail', { label: 'detail', min: 1, max: 80, step: 1 }),
      d.addBinding(params.detect, 'quadMinDepth', { label: 'min depth', min: 1, max: 10, step: 1 }),
      d.addBinding(params.detect, 'quadDepth', { label: 'max depth', min: 1, max: 10, step: 1 }),
    ]
    d.addBinding(params.detect, 'blur', { min: 0, max: 10, step: 1 })
    d.addBinding(params.detect, 'processSize', { label: 'resolution', min: 128, max: 1024, step: 32 })
    d.addBinding(params.detect, 'minSize', { label: 'min size', min: 1, max: 1000, step: 1 })
    d.addBinding(params.detect, 'maxSize', { label: 'max size', min: 10, max: 8000, step: 10 })
    d.addBinding(params.detect, 'maxCount', { label: 'max count', min: 1, max: 300, step: 1 })
    d.addBinding(params.detect, 'padding', { min: 0, max: 100, step: 1 })
    d.addBinding(params.detect, 'margin', { label: 'edge margin', min: 0, max: 2000, step: 1 })

    const bg = pane.addFolder({ title: 'Background', expanded: false })
    bg.addBinding(params.background, 'dim', { min: 0, max: 1, step: 0.05 })
    bg.addBinding(params.background, 'mono')

    // 描く順(ズーム、ぼかしかモザイク、モノクロ、色付け、反転)に並べる
    const fx = pane.addFolder({ title: 'Box effect' })
    fx.addBinding(params.effect, 'zoom', { min: 1, max: 4, step: 0.1 })
    fx.addBinding(params.effect, 'blur', { min: 0, max: 30, step: 0.5 })
    fx.addBinding(params.effect, 'mosaic', { min: 0, max: 60, step: 1 })
    fx.addBinding(params.effect, 'mono')
    fx.addBinding(params.effect, 'tint', { min: 0, max: 1, step: 0.05 })
    const tintColor = fx.addBinding(params.effect, 'tintColor', { label: 'tint color' })
    fx.addBinding(params.effect, 'invert')

    const fill = pane.addFolder({ title: 'Fill' })
    fill.addBinding(params.fill, 'mode', { options: { None: 'none', Solid: 'solid', Mesh: 'mesh' } })
    fill.addBinding(params.fill, 'color')
    fill.addBinding(params.fill, 'opacity', { min: 0, max: 1, step: 0.05 })
    const meshSpacing = fill.addBinding(params.fill, 'meshSpacing', { label: 'mesh spacing', min: 1, max: 20, step: 0.5 })
    const meshWidth = fill.addBinding(params.fill, 'meshWidth', { label: 'mesh width', min: 0.1, max: 4, step: 0.1 })

    const stroke = pane.addFolder({ title: 'Stroke' })
    stroke.addBinding(params.stroke, 'enabled')
    stroke.addBinding(params.stroke, 'style', { options: { Solid: 'solid', Dashed: 'dashed', Corners: 'corners' } })
    stroke.addBinding(params.stroke, 'color')
    stroke.addBinding(params.stroke, 'width', { min: 0.5, max: 10, step: 0.5 })

    const lines = pane.addFolder({ title: 'Lines' })
    lines.addBinding(params.lines, 'rule', {
      options: { None: 'none', Chain: 'chain', Nearest: 'nearest', Snapline: 'snapline' },
    })
    const neighbors = lines.addBinding(params.lines, 'neighbors', { min: 1, max: 5, step: 1 })
    const origin = lines.addBinding(params.lines, 'origin', { options: { Bottom: 'bottom', Center: 'center', Top: 'top' } })
    lines.addBinding(params.lines, 'shape', { options: { Straight: 'straight', Curve: 'curve' } })
    const curvature = lines.addBinding(params.lines, 'curvature', { min: -1, max: 1, step: 0.05 })
    lines.addBinding(params.lines, 'dashed')
    lines.addBinding(params.lines, 'color')
    lines.addBinding(params.lines, 'width', { min: 0.5, max: 10, step: 0.5 })
    lines.addBinding(params.lines, 'opacity', { min: 0, max: 1, step: 0.05 })

    const marker = pane.addFolder({ title: 'Marker' })
    marker.addBinding(params.marker, 'shape', {
      options: { None: 'none', Cross: 'cross', Dot: 'dot', Circle: 'circle' },
    })
    marker.addBinding(params.marker, 'size', { min: 2, max: 40, step: 1 })
    marker.addBinding(params.marker, 'color')

    const label = pane.addFolder({ title: 'Label' })
    label.addBinding(params.label, 'enabled')
    label.addBinding(params.label, 'template')
    label.addBinding(params.label, 'coordScale', { label: 'coords', options: { Pixel: 'pixel', 'Percent (0-100)': 'percent' } })
    label.addBinding(params.label, 'position', {
      options: { 'Top left': 'top-left', Inside: 'inside', Center: 'center', 'Bottom left': 'bottom-left' },
    })
    label.addBinding(params.label, 'size', { min: 4, max: 48, step: 1 })
    label.addBinding(params.label, 'color')
    label.addBinding(params.label, 'background')
    label.addBinding(params.label, 'backgroundColor', { label: 'bg color' })

    function syncVisibility() {
      quality.hidden = exportParams.format === 'png'
      // 未知の method は Worker が threshold として扱うので、それに合わせる
      for (const b of thresholdBindings) b.hidden = params.detect.method === 'quadtree'
      for (const b of quadtreeBindings) b.hidden = params.detect.method !== 'quadtree'
      tintColor.hidden = params.effect.tint <= 0
      meshSpacing.hidden = params.fill.mode !== 'mesh'
      meshWidth.hidden = params.fill.mode !== 'mesh'
      neighbors.hidden = params.lines.rule !== 'nearest'
      origin.hidden = params.lines.rule !== 'snapline'
      curvature.hidden = params.lines.shape !== 'curve'
    }
    function syncPreset() {
      const id = matchPreset(params) ?? CUSTOM
      if (presetState.preset === id) return
      presetState.preset = id
      presetBinding.refresh()
    }

    function afterChange() {
      syncVisibility()
      syncPreset()
      emit()
    }

    syncVisibility()
    replaceFolderMarks(pane.element)

    pane.on('change', (e) => {
      if (replacing || e.target === presetBinding || exportBindings.has(e.target)) return
      afterChange()
    })

    return () => {
      exportButtonRef.current = null
      pane.dispose()
    }
  }, [props.initial, props.initialExport])

  return <div ref={containerRef} />
}
