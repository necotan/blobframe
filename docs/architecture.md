# Architecture

How blobframe is built and how to extend it. Features and roadmap are in `docs/requirements.md`; settings keys and units are in `docs/settings.md`.

## Stack

| Role | Choice | Why |
|---|---|---|
| Build | Vite | No server rendering is needed; the app is a static SPA. |
| UI | React, Tailwind CSS v4 | Layout around the canvas and the panel. |
| Settings panel | Tweakpane v4 | Sliders, color pickers, lists, and folders with little code. Bindings mutate a plain object. |
| Icons | Lucide (`lucide`, the framework-free package) | Tweakpane builds plain DOM, so React icon components do not fit. |
| Font | Roboto Mono, bundled with `@fontsource-variable/roboto-mono` | One font for the panel, the page, and canvas labels on every device. Bundled instead of a font CDN so the app makes no third-party requests. |
| Detection | Web Worker, own TypeScript | Keeps the UI responsive. Simple methods do not need a library. |
| Drawing | Canvas 2D | Enough for images. WebGL2 is an option when video needs more speed. |
| Hosting | Vercel (Hobby), `blobframe.vercel.app` | Static files only, so the free plan is enough. Pull requests get preview URLs, and response headers (e.g. COOP/COEP that WASM threads may need for video) can be set in `vercel.json`. The Hobby plan is non-commercial only. |

Possible later additions: OpenCV.js loaded on demand for heavy methods (about 10 MB, so never in the main bundle), Rust compiled to WASM for speed, WebCodecs and Mediabunny for video.

## Pipeline

```
image (ImageBitmap)
  -> detector.ts: downscale to processSize on the main thread
  -> detect.worker.ts: grayscale -> blur -> method (threshold.ts or quadtree.ts) -> size filter, max count
  -> BlobRegion[] in source pixels
  -> render.ts: draw layers onto a canvas the size of the source
  -> PNG export from that canvas
```

- `App.tsx` re-runs detection only when `settings.detect` changes (compared as a JSON string) or the image changes, after an 80 ms debounce. Every other change only redraws.
- `detector.ts` gives each request an id and drops results that are not the latest, so a slow old result never overwrites a newer one.
- `App.tsx` keeps the image a result belongs to and ignores results for a previous image.

## Coordinate systems and units

- `BlobRegion` coordinates are in source image pixels. Detection works on a downscaled copy and scales boxes back by `source width / processed width`.
- Detection sizes (`minSize`, `maxSize`, `padding`) are in source pixels, because they describe what to find in that image.
- Style sizes (line width, mesh spacing, marker size, font size) are in the size unit `u = max(width, height) / 1000`, so a preset looks the same on a 800 px and a 6000 px image.
- Label coordinates are converted at draw time: pixels, or 0-100 of the image width and height.

## Render order

`render.ts` draws in this order; later layers cover earlier ones.

1. Source image.
2. Background: monochrome, then dim, over the whole image.
3. In-box effects per region: restore the original pixels (or a zoomed copy) inside the box, then monochrome, then invert.
4. Fill.
5. Lines.
6. Stroke.
7. Markers.
8. Labels (kept inside the image so export does not cut them).

## Effects without pixel loops

- Monochrome: fill gray with `globalCompositeOperation = 'saturation'`.
- Invert: fill white with `'difference'`.
- Zoom: `drawImage` from a smaller source rectangle centered on the region.
- `ctx.filter` is avoided because browser support differs. Per-pixel `getImageData` loops are avoided in the renderer because they get slow on large images and with many boxes; if an effect truly needs pixel access (e.g. thermal map), do it on the region only, or move effects to WebGL.

## Adding a detection method

1. Add the slug to `DetectSettings['method']` and its parameters to `DetectSettings` with defaults (`docs/settings.md`).
2. Write the method as a pure function in `src/lib/detect/<method>.ts` that takes the downscaled grayscale (or RGBA) image and returns `BlobRegion[]` in source pixels. Use `toRegion` in `common.ts` to convert a rectangle to source pixels, add padding, and apply the size filter, so `minSize`, `maxSize`, and `padding` mean the same in every method. Return regions sorted by area, largest first: the `chain` line rule starts from the first region.
3. Dispatch on `settings.method` in `detect.worker.ts`.
4. Add the bindings in the Detect folder of `ControlPane.tsx` and hide the parameters of other methods in `syncVisibility`.

## Adding a style option

1. Add the key and default to `Settings` (`docs/settings.md`).
2. Add the binding in `ControlPane.tsx`; hide it in `syncVisibility` when it has no effect.
3. Draw it in `render.ts` in the right layer, using `u` for sizes.

## Adding a built-in preset

1. Add an entry to `PRESETS` in `src/lib/presets.ts` with only the keys that differ from `DEFAULT_SETTINGS`.
2. Keep every value on the slider's step and inside its range in `ControlPane.tsx`, and write colors as lowercase `#rrggbb`. The panel writes back rounded values, and a preset that changes when applied shows as Custom.
3. When a new settings key is added, check whether existing presets should set it.

Presets inherit every key they do not set from `DEFAULT_SETTINGS`, so changing a default changes those presets too. When changing `DEFAULT_SETTINGS`, compare the values of all presets before and after, and set the old value explicitly in each preset whose look would change.

## Settings panel customizations

Tweakpane is used as is from npm. Its look is changed only from `src/components/pane/`:

- `dropdownPlugin.ts`: an input binding plugin that replaces Tweakpane's `<select>`, whose opened list is drawn by the OS and cannot be styled. Plugins registered with `pane.registerPlugin` are tried before the built-in ones, so every string binding with `options` uses it; `ControlPane.tsx` keeps calling `addBinding(..., { options })`.
  - The list is appended to the pane root (`.tp-rotv`) so it inherits Tweakpane's CSS variables, and uses `position: fixed` so the scrolling sidebar does not clip it. It opens upward when there is more room above.
  - Focus stays on the button; the list is driven by `aria-activedescendant`. Keys: ArrowUp / ArrowDown / Enter / Space open; ArrowUp / ArrowDown / Home / End move; Enter / Space select; Escape and Tab close.
  - It closes on an outside pointer down, blur, window resize, and any scroll outside the list, because a fixed list would otherwise stay behind when the button moves.
- `folderIcons.ts` and `pane.css`: replace the folder open/close mark (two CSS bars) with a Lucide chevron. Tweakpane injects its `<style>` at runtime after ours, so overrides need a more specific selector than Tweakpane's rule.
- `@tweakpane/core` is a runtime dependency because the plugin uses its helpers. Keep its major version equal to the one bundled in `tweakpane`; `registerPlugin` rejects a plugin built for another major version.

## Font

- The font family is written only once, as Tailwind's `--font-mono` in `index.css`, which also imports the font package. `--default-font-family` points to it, so it is the page default.
- `pane.css` passes `var(--font-mono)` to Tweakpane (`--tp-base-font-family`).
- A canvas does not inherit CSS, so `render.ts` reads the variable through `monoFontFamily()` in `src/lib/fonts.ts`.
- A canvas draws with whatever font is available at that moment and keeps it. `App.tsx` waits for `loadMonoFont()` and redraws, so labels drawn before the font loaded are replaced.

## Toward video

- `render()` takes any `CanvasImageSource`, so a video frame can be passed as is.
- Detection would run per frame in the worker; a tracker between detection and rendering would assign stable ids and smooth boxes. Keep that tracker outside `lib/detect/` so image mode does not depend on it.
- Export would draw each frame with `render()` and encode it with WebCodecs.
