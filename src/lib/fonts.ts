/**
 * index.css の `--font-mono` の値。キャンバスは CSS を継承しないので、ラベルを描くときにここから読む。
 * index.css が読み込まれた後に呼ぶこと。
 */
export function monoFontFamily(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'monospace'
}

/**
 * 等幅フォントの読み込みを待つ。キャンバスは読み込み前に描くと代替フォントで描かれたまま残るので、完了後に描き直すこと。
 */
export function loadMonoFont(): Promise<unknown> {
  // Web フォントは文字が使われるまで読み込まれず、キャンバスでの使用はそのきっかけにならないため明示的に読み込む
  return document.fonts.load(`16px ${monoFontFamily()}`).catch(() => undefined)
}
