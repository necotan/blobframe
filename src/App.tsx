import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ControlPane } from './components/ControlPane'
import { createDetector } from './lib/detect/detector'
import { downloadBlob, pickFile, timestamp } from './lib/download'
import { extensionOf, mergeExportSettings, type ExportSettings } from './lib/exportSettings'
import { loadMonoFont } from './lib/fonts'
import { loadImage } from './lib/image'
import { render } from './lib/render/render'
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from './lib/settings'
import type { BlobRegion } from './lib/types'

const STORAGE_KEY = 'blobframe:settings'
const EXPORT_STORAGE_KEY = 'blobframe:export'
// スライダーを動かしている間に検出が詰まらないよう、止まってから走らせる
const DETECT_DEBOUNCE_MS = 80

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? mergeSettings(DEFAULT_SETTINGS, JSON.parse(saved)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function loadExportSettings(): ExportSettings {
  try {
    return mergeExportSettings(JSON.parse(localStorage.getItem(EXPORT_STORAGE_KEY) ?? 'null'))
  } catch {
    return mergeExportSettings(null)
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // プライベートブラウズ等で保存できなくても編集は続けられる
  }
}

// main の左右の余白 (p-4) と下の余白 (pb-8) を足す。高すぎるとパネルが使えないので画面の 60% までにする
function stackHeight(image: { width: number; height: number }): string {
  return `min(calc((100vw - 2rem) * ${image.height / image.width} + 3rem), 60dvh)`
}

type Detection = { source: ImageBitmap; regions: BlobRegion[] }

export default function App() {
  const [initialSettings] = useState(loadSettings)
  const [settings, setSettings] = useState(initialSettings)
  const [initialExport] = useState(loadExportSettings)
  // 書き出しの設定は描画に使わないので、state にして再描画させない
  const exportSettingsRef = useRef(initialExport)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null)
  const [detection, setDetection] = useState<Detection | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fontReady, setFontReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectorRef = useRef<ReturnType<typeof createDetector> | null>(null)
  const loadIdRef = useRef(0)

  useEffect(() => {
    let active = true
    loadMonoFont().then(() => active && setFontReady(true))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const detector = createDetector()
    detectorRef.current = detector
    return () => {
      detectorRef.current = null
      detector.dispose()
    }
  }, [])

  // 見た目だけの変更で再検出しないよう、検出設定は文字列化して比較する
  const detectKey = JSON.stringify(settings.detect)
  useEffect(() => {
    if (!image) return
    const detectSettings = JSON.parse(detectKey) as Settings['detect']
    const timer = setTimeout(() => {
      detectorRef.current?.detect(image, detectSettings).then((regions) => setDetection({ source: image, regions }))
    }, DETECT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [image, detectKey])

  // 画像を差し替えた直後は前の画像の検出結果を使わない
  const regions = useMemo(
    () => (detection && detection.source === image ? detection.regions : []),
    [detection, image],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    if (canvas.width !== image.width || canvas.height !== image.height) {
      canvas.width = image.width
      canvas.height = image.height
    }
    const ctx = canvas.getContext('2d')
    // iOS は canvas のメモリ上限を超えると null を返す。例外にすると React が画面全体を外して真っ白になる
    if (ctx) render(ctx, image, regions, settings)
    // fontReady は描画には使わないが、フォント読み込み後にラベルを描き直すために依存に入れる
  }, [image, regions, settings, fontReady])

  const handleSettingsChange = useCallback((next: Settings) => {
    setSettings(next)
    saveToStorage(STORAGE_KEY, next)
  }, [])

  const handleExportChange = useCallback((next: ExportSettings) => {
    exportSettingsRef.current = next
    saveToStorage(EXPORT_STORAGE_KEY, next)
  }, [])

  const loadFile = useCallback(async (file: File | null | undefined) => {
    // file.type は端末や選び方によって空や想定外の値になるので、種類では弾かずに読み込めるかで判断する
    if (!file) return
    const id = ++loadIdRef.current
    setLoading(true)
    setError(false)
    try {
      const { bitmap, original } = await loadImage(file)
      // 大きな画像の読み込み中に次の画像が選ばれたら、遅れて終わった古いほうは捨てる
      if (id !== loadIdRef.current) return bitmap.close()
      setOriginalSize(original)
      setImage((prev) => {
        prev?.close()
        return bitmap
      })
    } catch {
      if (id === loadIdRef.current) setError(true)
    } finally {
      if (id === loadIdRef.current) setLoading(false)
    }
  }, [])

  const openImage = useCallback(async () => loadFile(await pickFile('image/*')), [loadFile])

  const exportImage = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const { format, quality, scale } = exportSettingsRef.current
    let target = canvas
    if (scale !== 1) {
      // 表示中の canvas を縮めるより描き直すほうが、線や文字がにじまない
      target = document.createElement('canvas')
      target.width = Math.max(1, Math.round(image.width * scale))
      target.height = Math.max(1, Math.round(image.height * scale))
      const ctx = target.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingQuality = 'high'
      ctx.scale(target.width / image.width, target.height / image.height)
      render(ctx, image, regions, settings)
    }
    const blob = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, `image/${format}`, quality))
    // iOS は canvas のメモリをすぐには返さず上限に数えたままにするので、書き出し用に作った分は大きさを0にして手放す
    if (target !== canvas) target.width = target.height = 0
    if (blob) downloadBlob(blob, `blobframe-${timestamp()}.${extensionOf(blob)}`)
  }, [image, regions, settings])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) loadFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadFile])

  return (
    // 縦長の画面では画像を上、パネルを下に重ね、画像の欄は画像の縦横比に合わせて余白を作らない。
    // 横長で十分な幅があるときだけパネルを右に並べる
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-200 md:landscape:flex-row">
      <main
        style={image ? ({ '--stack-height': stackHeight(image) } as CSSProperties) : undefined}
        className={`relative flex min-h-0 items-center justify-center p-4 pb-8 md:landscape:h-auto md:landscape:flex-1 ${image ? 'h-(--stack-height) shrink-0' : 'flex-1'} ${dragging ? 'bg-neutral-900' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          loadFile(e.dataTransfer.files[0])
        }}
      >
        <canvas ref={canvasRef} className={`max-h-full max-w-full object-contain ${image ? '' : 'hidden'}`} />
        {!image && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-neutral-400">
              <span className="pointer-coarse:hidden">Drop, paste, or open an image</span>
              <span className="hidden pointer-coarse:inline">Choose an image to start</span>
            </p>
            <button
              type="button"
              onClick={openImage}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 pointer-coarse:px-6 pointer-coarse:py-3"
            >
              Open image
            </button>
            {loading && <p className="text-sm text-neutral-400">Loading...</p>}
            {error && <p className="text-sm text-red-400">Could not read this image</p>}
          </div>
        )}
        {image && (
          <p className="absolute bottom-2 left-4 font-mono text-xs text-neutral-500">
            {originalSize && `${originalSize.width}x${originalSize.height} -> `}
            {image.width}x{image.height} / {regions.length} blobs
            {loading && ' / Loading...'}
            {error && <span className="text-red-400"> / Could not read this image</span>}
          </p>
        )}
      </main>
      <aside className="min-h-0 flex-1 overflow-y-auto border-t border-neutral-800 md:landscape:w-80 md:landscape:flex-none md:landscape:border-t-0 md:landscape:border-l">
        <ControlPane
          initial={initialSettings}
          onChange={handleSettingsChange}
          initialExport={initialExport}
          onExportChange={handleExportChange}
          onOpenImage={openImage}
          onExportImage={exportImage}
          canExport={image !== null}
        />
      </aside>
    </div>
  )
}
