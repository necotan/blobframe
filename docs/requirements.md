# Requirements

What blobframe does and what is planned. How the code is organized is in `docs/architecture.md`; settings keys and units are in `docs/settings.md`.

## Glossary

| Term | Code | Meaning |
|---|---|---|
| Region | `BlobRegion` | One detected area: bounding box, center, pixel count, mean luminance. Named `BlobRegion` because `Blob` is a DOM type. |
| Detection | `lib/detect/` | Turning an image into `BlobRegion[]`. |
| Detection method | `DetectSettings.method` | The algorithm used for detection: `threshold` or `quadtree`. |
| Level | `DetectSettings.levels` | One threshold step. Several levels give nested boxes of different sizes. |
| Depth | `DetectSettings.quadDepth`, `quadMinDepth` | How many times a quadtree cell was split. Each split halves the side. |
| Detail | `DetectSettings.quadDetail` | Standard deviation of brightness inside a quadtree cell. |
| Style | every `Settings` group except `detect` | How regions are drawn. Changing it does not re-run detection. |
| Preset | `Settings` with a name | Built-in ones are in `presets.ts`. A preset file is `Settings` as JSON, saved and loaded from the Preset folder of the panel. |
| Size unit | `u` in `render.ts` | 1/1000 of the image's long side. Style sizes are in this unit. |

## Overview

- A web app that draws a "blob tracking" look over an image: boxes around detected regions, lines connecting them, center markers, coordinate labels, and effects inside the boxes.
- Everything runs in the browser. Images are never uploaded, and there is no account or server.
- Users choose the detection method and customize every visual element; the result is exported as an image.

## Input

- Images the browser can decode (PNG, JPEG, WebP, AVIF, etc.), opened from a file picker, drag and drop, or paste.
- Video (MP4, etc.) is not supported yet; see Roadmap.

## Current features

- Detection, threshold: brightness threshold with connected-component labeling.
  - Parameters: target (bright or dark), threshold range, levels.
  - Boxes that overlap heavily or share almost the same center are merged, so levels do not stack identical labels.
- Detection, quadtree: split cells into four while their detail is above a limit.
  - Parameters: detail, min depth, max depth.
  - Only cells with at least half the detail limit become boxes, so flat areas stay empty. Cells larger than min depth are skipped.
  - `minSize` also stops splitting, so detailed areas are not lost as boxes too small to keep.
- Shared detection parameters: blur, processing resolution, min and max box size, max count, max overlap (drop smaller boxes that overlap a larger one by more than this share), padding, edge margin (no boxes within this distance of the image edges).
- Background: dim, monochrome.
- In-box effects, applied in this order and combinable: zoom, blur or mosaic (mosaic wins when both are set; mosaic cells align to one grid over the whole image), monochrome, tint (keeps brightness, replaces hue and saturation), invert.
- Fill: none, solid, mesh (spacing and line width).
- Stroke: on or off, solid, dashed, or corners only.
- Lines: none, chain (greedy nearest path from the largest region), nearest k, minimum spanning tree, Delaunay triangulation, all pairs within a radius, snapline (from the bottom, center, or top of the image to each region); straight or curved (curvature); dashed; color, width, opacity; ends at the box center or cut at the box edge, with a gap; end caps (arrow at the end, arrows at both ends, dots, bars).
- Marker: none, cross, dot, circle.
- Label: template (`{x:03}` style placeholders), coordinates in pixels or 0-100, position, overlap handling (allow, move to a free position, or move and hide when none is free), font size, colors, background band.
- Output: JPEG (default), PNG, or WebP; quality for JPEG and WebP; scale 0.1-1 of the source resolution, redrawn at that size so lines and labels stay sharp. Export settings are kept in the browser apart from the look settings, so presets do not change them.
- Presets: twelve built-in looks (Default, Tracker, Quadtree Mesh, Minimal, Invert, Blueprint, Hacker, ESP, Aimbot, Censor, Heat, Frosted). Applying one replaces all settings, detection included. The list shows Custom when the settings match no preset.
- Settings: saved automatically in the browser; saved and loaded as JSON files. Choosing the Default preset resets to defaults.
- UI text is English.
- Layout: works on PC, tablets, and smartphones in both orientations, with touch-sized controls on touch devices. Images too large for the device canvas (iOS Safari) are shrunk on load.

## Roadmap

### Phase 2: more methods and styles

- Detection methods: adaptive threshold, color range (HSV), edges and contours (Sobel, Canny), scale-space blobs (LoG, DoG), feature-point clusters (FAST), seeded random weighted by brightness.
- Detection options: aspect ratio limit, sort order (area, brightness, position).
- In-box effects: threshold, edge, posterize, thermal color map, RGB shift; stacking several; a random effect per box.
- Fill: hatching, dots, scanlines; blend mode.
- Lines: random; elbow and arc shapes.
- Marker: crosshair.
- Label: more values (color hex, score), more positions.
- Background: vignette, scanlines, noise, grid.
- Output: 2x resolution, transparent overlay only (for compositing).
- Presets: a named list stored in the browser, shareable by URL.
- Layer order: let users reorder fill, lines, stroke, markers, and labels.
- UI text in Japanese and English.

### Phase 3: video

- Input MP4 and other browser-decodable video; process frame by frame.
- Tracking: keep the same id for the same region across frames (IoU or center distance matching) and smooth positions.
- Output MP4 with WebCodecs and Mediabunny.
- Motion difference as a detection method.

## Non-goals

- Server-side processing or image upload.
- Accounts or cloud storage.
- Machine-learning object detection is not planned for now; reconsider only if a lightweight in-browser model fits the "no upload" rule.
