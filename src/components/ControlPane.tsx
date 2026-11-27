import { useEffect, useLayoutEffect, useRef } from 'react'
import { Pane } from 'tweakpane'
import { downloadBlob, pickFile, timestamp } from '../lib/download'
import { DEFAULT_SETTINGS, cloneSettings, mergeSettings, type Settings } from '../lib/settings'
import { DropdownPlugin } from './pane/dropdownPlugin'
import { replaceFolderMarks } from './pane/folderIcons'
import './pane/pane.css'

type Props = {
  /** パネル生成時の初期値。変わるとパネルを作り直すので、呼び出し側で固定した値を渡すこと */
  initial: Settings
  onChange: (settings: Settings) => void
  onOpenImage: () => void
  onExportImage: () => void
  canExport: boolean
}

export function ControlPane(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  const exportButtonRef = useRef<{ disabled: boolean } | null>(null)

  // パネルは一度だけ作り、最新のコールバックは ref 経由で呼ぶ
  useLayoutEffect(() => {
    propsRef.current = props
    if (exportButtonRef.current) exportButtonRef.current.disabled = !props.canExport
  })

  useEffect(() => {
    const params = cloneSettings(props.initial)
    const pane = new Pane({ container: containerRef.current! })
    pane.registerPlugin({ id: 'blobframe', plugins: [DropdownPlugin] })
    const emit = () => propsRef.current.onChange(cloneSettings(params))

    const replaceAll = (next: Settings) => {
      for (const group of Object.keys(params) as (keyof Settings)[]) Object.assign(params[group], next[group])
      pane.refresh()
      syncVisibility()
      emit()
    }

    const file = pane.addFolder({ title: 'File' })
    file.addButton({ title: 'Open image' }).on('click', () => propsRef.current.onOpenImage())
    const exportButton = file.addButton({ title: 'Export PNG' })
    exportButton.on('click', () => propsRef.current.onExportImage())
    exportButton.disabled = !propsRef.current.canExport
    exportButtonRef.current = exportButton
    file.addButton({ title: 'Save preset' }).on('click', () => {
      const json = JSON.stringify(params, null, 2)
      downloadBlob(new Blob([json], { type: 'application/json' }), `blobframe-preset-${timestamp()}.json`)
    })
    file.addButton({ title: 'Load preset' }).on('click', async () => {
      const f = await pickFile('application/json,.json')
      if (!f) return
      try {
        replaceAll(mergeSettings(DEFAULT_SETTINGS, JSON.parse(await f.text())))
      } catch {
        // 壊れた JSON は読み込まずに今の設定を保つ
      }
    })
    file.addButton({ title: 'Reset' }).on('click', () => replaceAll(cloneSettings(DEFAULT_SETTINGS)))

    const d = pane.addFolder({ title: 'Detect' })
    d.addBinding(params.detect, 'target', { options: { Bright: 'bright', Dark: 'dark' } })
    d.addBinding(params.detect, 'thresholdMin', { label: 'threshold min', min: 0, max: 255, step: 1 })
    d.addBinding(params.detect, 'thresholdMax', { label: 'threshold max', min: 0, max: 255, step: 1 })
    d.addBinding(params.detect, 'levels', { min: 1, max: 8, step: 1 })
    d.addBinding(params.detect, 'blur', { min: 0, max: 10, step: 1 })
    d.addBinding(params.detect, 'processSize', { label: 'resolution', min: 128, max: 1024, step: 32 })
    d.addBinding(params.detect, 'minSize', { label: 'min size', min: 1, max: 1000, step: 1 })
    d.addBinding(params.detect, 'maxSize', { label: 'max size', min: 10, max: 8000, step: 10 })
    d.addBinding(params.detect, 'maxCount', { label: 'max count', min: 1, max: 300, step: 1 })
    d.addBinding(params.detect, 'padding', { min: 0, max: 100, step: 1 })

    const bg = pane.addFolder({ title: 'Background', expanded: false })
    bg.addBinding(params.background, 'dim', { min: 0, max: 1, step: 0.05 })
    bg.addBinding(params.background, 'mono')

    const fx = pane.addFolder({ title: 'Box effect' })
    fx.addBinding(params.effect, 'invert')
    fx.addBinding(params.effect, 'mono')
    fx.addBinding(params.effect, 'zoom', { min: 1, max: 4, step: 0.1 })

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
    lines.addBinding(params.lines, 'rule', { options: { None: 'none', Chain: 'chain', Nearest: 'nearest' } })
    const neighbors = lines.addBinding(params.lines, 'neighbors', { min: 1, max: 5, step: 1 })
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
      meshSpacing.hidden = params.fill.mode !== 'mesh'
      meshWidth.hidden = params.fill.mode !== 'mesh'
      neighbors.hidden = params.lines.rule !== 'nearest'
      curvature.hidden = params.lines.shape !== 'curve'
    }
    syncVisibility()
    replaceFolderMarks(pane.element)

    pane.on('change', () => {
      syncVisibility()
      emit()
    })

    return () => {
      exportButtonRef.current = null
      pane.dispose()
    }
  }, [props.initial])

  return <div ref={containerRef} />
}
