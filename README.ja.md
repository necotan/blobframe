<h1 align="center">blobframe</h1>

<p align="center">
  <a href="README.md">English</a> | 日本語
</p>

<p align="center">
  画像の中の領域を検出し、四角、接続線、マーカー、座標ラベル、四角の中のエフェクトで<br>
  「blob tracking」風の見た目を重ねるブラウザツールです。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white">
  <img src="https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img src="https://img.shields.io/badge/Tweakpane-4-000000">
  <br>
  <a href="https://blobframe.vercel.app"><img src="https://img.shields.io/badge/Demo-Vercel-000000?logo=vercel&logoColor=white"></a>
</p>

## クイックスタート
インストール不要で、ブラウザですぐに試せます。

**[blobframe.vercel.app](https://blobframe.vercel.app)**

## 機能
画像を開くと、領域を見つけて四角で囲みます。見た目はすべて設定パネルから変えられ、スライダーを動かすとその場で描き直されます。

- **検出**: 2つの方式から選べます。
  - しきい値: 明るい(または暗い)領域を複数段階の輝度で探すので、大小の四角が混ざります。
  - Quadtree: 細かい部分ほど画像を小さく分割するので、輪郭や模様の周りに四角が集まります。
  - どちらも四角の最小・最大サイズ、最大個数、ぼかし、余白を調整できます。
- **四角**: 実線、破線、角だけの枠線と、全面またはメッシュの塗り。
- **四角の中**: 色反転、モノクロ、ズーム。四角の外は暗くしたりモノクロにしたりできます。
- **接続線**: 四角を近い順に1本につなぐか、近いもの同士をつなぎます。直線か曲線、実線か破線を選べます。
- **マーカーとラベル**: 中心に十字、点、円を表示し、`X{x:03}Y{y:03}` のようなテンプレートからラベルを作ります(-> `X075Y034`)。
- **書き出し**: 元の解像度で PNG に書き出します。設定はプリセットの JSON ファイルとして保存、読み込みできます。

処理はすべてブラウザ内で行い、画像をアップロードすることはありません。

今は画像のみ対応で、動画対応を予定しています。今後の予定は [docs/requirements.md](docs/requirements.md) を参照してください。

## 使い方
1. 画像をページにドロップするか、貼り付けるか、**Open image** から開きます。
2. **Detect** フォルダで、四角が思った場所に付くまで検出を調整します。
3. ほかのフォルダ(Box effect、Fill、Stroke、Lines、Marker、Label、Background)で見た目を変えます。
4. **Export PNG** で書き出します。

線の太さや文字の大きさは画像の大きさに合わせて変わるので、同じプリセットなら小さい画像でも大きい画像でも同じ見た目になります。

## 開発
サーバーやデータベースは不要です。

### 必要なもの
- Node.js 24.22.3 以降(24.x)

### 手順

1. リポジトリをクローン
   ```bash
   git clone https://github.com/necotan/blobframe.git
   cd blobframe
   ```
2. 依存パッケージをインストール
   ```bash
   npm install
   ```
3. 開発サーバーを起動
   ```bash
   npm run dev
   ```
4. ターミナルに表示された URL(通常は `http://localhost:5173`)を開きます。

### コマンド
- `npm run build`: 型チェックをして `dist/` にビルド
- `npm run preview`: ビルド結果をローカルで配信
- `npm run lint`: ESLint(警告も失敗扱い)
- `npm run typecheck`: 型チェックのみ

### Git フック(変更をコミットする場合)
コミットする場合は、クローンごとに1回 `.githooks/` のフックを有効にしてください。
```bash
git config core.hooksPath .githooks
```
`pre-commit` は `npm run lint` と `npm run typecheck` を実行し、`commit-msg` は1行目の書式を確認します。アプリを動かすだけなら不要です。

### 設計ドキュメント
- [docs/requirements.md](docs/requirements.md): 機能、今後の予定、やらないこと
- [docs/architecture.md](docs/architecture.md): 処理の流れ、座標系、検出方式や見た目の項目を追加する手順
- [docs/settings.md](docs/settings.md): 設定キー、単位、プリセットの互換性

## 技術スタックとクレジット
このプロジェクトは以下の技術とオープンソースライブラリで作られています。

- **ビルド**: [Vite](https://vite.dev/)
- **フレームワーク**: [React](https://react.dev/) / [TypeScript](https://www.typescriptlang.org/)
- **スタイリング**: [Tailwind CSS](https://tailwindcss.com/)(v4)
- **設定パネル**: [Tweakpane](https://tweakpane.github.io/docs/)
- **アイコン**: [Lucide](https://lucide.dev/)(ISC ライセンス)
- **フォント**: [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono)([Fontsource](https://fontsource.org/) 経由、SIL OFL 1.1)
- **検出**: Web Worker 上の独自実装(しきい値と連結成分ラベリング、積分画像による Quadtree)
- **描画**: Canvas 2D
- **ホスティング**: [Vercel](https://vercel.com/)

## ディレクトリ構成

```text
/
├── src/
│   ├── App.tsx            # 画像の読み込み(ファイル、ドロップ、貼り付け)、検出と描画の実行、PNG 書き出し
│   ├── components/        # ControlPane(Tweakpane の設定パネル)
│   │   └── pane/          # Tweakpane のカスタマイズ(自前のドロップダウン、フォルダのアイコン、CSS)
│   └── lib/
│       ├── settings.ts    # 設定の型、既定値、保存済み JSON の読み込み
│       ├── detect/        # detector.ts(メインスレッド側)、detect.worker.ts、threshold.ts、quadtree.ts、common.ts
│       └── render/        # render.ts(レイヤー描画)、connections.ts(線の組み合わせ)、label.ts(ラベルのテンプレート)
├── docs/                  # 設計ドキュメント(requirements、architecture、settings)
├── .githooks/             # pre-commit、commit-msg
├── index.html
├── vite.config.ts
└── package.json
```

## 免責事項

**1. データの取り扱いとプライバシー**
画像はブラウザ内でのみ処理され、どのサーバーにも送信されません。設定はブラウザのローカルストレージに保存されます。

**2. 動作環境**
最新の Chrome、Edge、Safari、Firefox での動作を想定しています。すべての端末やブラウザでの動作は保証しません。また、メモリの少ない端末ではとても大きな画像の処理が遅くなったり失敗したりすることがあります。

**3. 免責と責任の制限**
本ソフトウェアは個人のプロジェクトで、現状のまま提供されます。利用によって生じたいかなる損害についても、開発者は責任を負いません。ご自身の責任で利用し、処理・公開する画像の権利を持っていることを確認してください。
