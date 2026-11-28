<h1 align="center">BlobFrame</h1>

<p align="center">
  English | <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  A browser tool that detects regions in an image and draws a "blob tracking" look over them:<br>
  boxes, connecting lines, markers, coordinate labels, and effects inside the boxes.
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

## Quick Start
Try it right away in your browser, no setup needed.

**[blobframe.vercel.app](https://blobframe.vercel.app)**

## Features
Open an image, and blobframe finds regions and frames them. Every part of the look can be changed from the settings panel, and the result is redrawn as you move a slider.

- **Detection**: two methods.
  - Threshold: bright (or dark) regions, found at several brightness levels, so large and small boxes mix.
  - Quadtree: the image is split into smaller cells where it has more detail, so boxes gather around edges and texture.
  - Min and max box size, max count, blur, and padding are adjustable for both. An edge margin keeps boxes away from the image edges.
- **Boxes**: solid, dashed, or corner-only outlines; solid or mesh fill.
- **Inside the boxes**: zoom, blur, mosaic, monochrome, tint, invert, combined freely. The area outside can be dimmed or made monochrome.
- **Lines**: connect boxes in a chain or to their nearest neighbors, or draw snaplines from the bottom, center, or top of the image to each box, with straight or curved, solid or dashed lines.
- **Markers and labels**: a cross, dot, or circle at the center, and labels from a template such as `X{x:03}Y{y:03}` (-> `X075Y034`).
- **Presets**: twelve built-in looks (Default, Tracker, Quadtree Mesh, Minimal, Invert, Blueprint, Hacker, ESP, Aimbot, Censor, Heat, Frosted) to start from. Your own settings can be saved and loaded as JSON files.
- **Export**: JPEG, PNG, or WebP, with quality and scale (10-100% of the original resolution).

All processing runs in your browser. Images are never uploaded.

Images only for now; video support is planned. See [docs/requirements.md](docs/requirements.md) for the roadmap.

## Usage
1. Drop an image on the page, paste one, or click **Open image**.
2. Pick a look in the **Preset** folder.
3. Adjust detection in the **Detect** folder until the boxes land where you want.
4. Change the look in the other folders (Box effect, Fill, Stroke, Lines, Marker, Label, Background).
5. Pick the format, quality, and scale in the **File** folder, then click **Export image**. JPEG (the default) stays about the size of a camera photo; PNG is lossless but several times larger. WebP is the smallest but can take tens of seconds for a large photo, and Safari saves it as PNG.

Line widths and text sizes scale with the image, so a preset looks the same on small and large images.

## Development
No server or database is needed.

### Prerequisites
- Node.js 24.22.3 or later (24.x)

### Steps

1. Clone the repository
   ```bash
   git clone https://github.com/necotan/blobframe.git
   cd blobframe
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Start the development server
   ```bash
   npm run dev
   ```
4. Open the URL shown in the terminal (usually `http://localhost:5173`).

### Commands
- `npm run build`: type check and build into `dist/`
- `npm run preview`: serve the build locally
- `npm run lint`: ESLint (warnings fail too)
- `npm run typecheck`: type check only

### Git Hooks (for committing changes)
If you plan to commit, enable the hooks in `.githooks/` once per clone:
```bash
git config core.hooksPath .githooks
```
`pre-commit` runs `npm run lint` and `npm run typecheck`, and `commit-msg` checks the format of the first line. This is not needed just to run the app.

### Design Docs
- [docs/requirements.md](docs/requirements.md): features, roadmap, non-goals
- [docs/architecture.md](docs/architecture.md): pipeline, coordinate systems, how to add a detection method or a style option
- [docs/settings.md](docs/settings.md): settings keys, units, preset compatibility

## Tech Stack & Credits
This project is built with the following technologies and open-source libraries.

- **Build**: [Vite](https://vite.dev/)
- **Framework**: [React](https://react.dev/) / [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4)
- **Settings panel**: [Tweakpane](https://tweakpane.github.io/docs/)
- **Icons**: [Lucide](https://lucide.dev/) (Licensed under ISC)
- **Font**: [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono) via [Fontsource](https://fontsource.org/) (Licensed under SIL OFL 1.1)
- **Detection**: own implementation in a Web Worker (threshold with connected-component labeling, quadtree with integral images)
- **Drawing**: Canvas 2D
- **Hosting**: [Vercel](https://vercel.com/)

## Project Structure

```text
/
├── src/
│   ├── App.tsx            # Image loading (file, drop, paste), detection and render scheduling, export
│   ├── components/        # ControlPane (Tweakpane settings panel)
│   │   └── pane/          # Tweakpane customizations (own dropdown plugin, folder icons, CSS)
│   └── lib/
│       ├── settings.ts    # Settings type, defaults, loading saved JSON
│       ├── presets.ts     # Built-in presets
│       ├── exportSettings.ts # Export format, quality, scale
│       ├── image.ts       # Image loading, shrinking images too large for the device
│       ├── detect/        # detector.ts (main thread), detect.worker.ts, threshold.ts, quadtree.ts, common.ts
│       └── render/        # render.ts (layers), connections.ts (line pairs), label.ts (label templates)
├── docs/                  # Design docs (requirements, architecture, settings)
├── .githooks/             # pre-commit, commit-msg
├── index.html
├── vite.config.ts
└── package.json
```

## Disclaimer

**1. Data Handling and Privacy**
Images are processed only in your browser and are not sent to any server. Settings are saved in your browser's local storage.

**2. Supported Environments**
This app is intended to run on current versions of Chrome, Edge, Safari, and Firefox. It is not guaranteed to work on every device or browser, and very large images may be slow or fail on devices with little memory.

**3. Disclaimer and Limitation of Liability**
This software is a personal project provided "as is". The developer accepts no liability for any damages arising from using it. Use it at your own risk, and make sure you have the rights to the images you process and publish.
