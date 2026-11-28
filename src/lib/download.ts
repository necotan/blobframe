export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // click 直後に revoke すると一部ブラウザでダウンロードが始まらないため少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    // iOS Safari は DOM に無い input を選択中に GC で片づけることがあり、そのとき選んだファイルは捨てられて change が来ない。
    // 写真ライブラリが渡す前の準備に時間のかかる大きな写真ほど起きやすいので、選び終わるまでページに置いて参照を保つ
    input.className = 'sr-only'
    document.body.append(input)
    const done = (file: File | null) => {
      input.remove()
      resolve(file)
    }
    input.addEventListener('change', () => done(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => done(null), { once: true })
    input.click()
  })
}
