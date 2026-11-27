/**
 * 書き出しの設定。見た目の設定 (Settings) とは分けて保存する。
 * Settings に入れるとプリセットの適用で形式まで変わり、形式を変えただけで一覧が Custom になるため。
 */
export type ExportSettings = {
  format: 'png' | 'jpeg' | 'webp'
  /** jpeg と webp の品質 0-1。png では使わない */
  quality: number
  /** 元画像に対する書き出しの倍率 */
  scale: number
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  // WebP は Safari が書き出しに対応しておらず PNG になるので、どのブラウザでも小さくなる JPEG を既定にする
  format: 'jpeg',
  quality: 0.92,
  scale: 1,
}

const FORMATS: ExportSettings['format'][] = ['png', 'jpeg', 'webp']

/** 保存済み JSON を既定値に重ねる。未知の形式や範囲外の数値は既定値に戻す。 */
export function mergeExportSettings(input: unknown): ExportSettings {
  const result = { ...DEFAULT_EXPORT_SETTINGS }
  if (typeof input !== 'object' || input === null) return result
  const src = input as Record<string, unknown>
  if (FORMATS.includes(src.format as ExportSettings['format'])) result.format = src.format as ExportSettings['format']
  if (typeof src.quality === 'number' && src.quality > 0 && src.quality <= 1) result.quality = src.quality
  if (typeof src.scale === 'number' && src.scale > 0 && src.scale <= 1) result.scale = src.scale
  return result
}

/** Blob の実際の形式から拡張子を決める。ブラウザが対応しない形式を頼むと PNG で返ってくるため。 */
export function extensionOf(blob: Blob): string {
  if (blob.type === 'image/jpeg') return 'jpg'
  if (blob.type === 'image/webp') return 'webp'
  return 'png'
}
