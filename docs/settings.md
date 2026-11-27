# Settings

The `Settings` object (`src/lib/settings.ts`) is the app state, what is saved in the browser, and the content of preset files. Its keys and slugs are therefore a stored format: changing them affects users' saved data.

## Where it is stored

| Place | Key or name | Written by |
|---|---|---|
| `localStorage` | `blobframe:settings` | `App.tsx`, on every change |
| Preset file | `blobframe-preset-<timestamp>.json` | Save preset button in `ControlPane.tsx` |

Both are plain `JSON.stringify(settings)` with no version field.

## Loading rules

`mergeSettings(DEFAULT_SETTINGS, input)` reads both places:

- Keys missing from the input keep their default. Adding a key is safe.
- Unknown keys are dropped.
- A value whose JSON type differs from the default (e.g. a string where a number is expected) is dropped.
- String slugs (e.g. `fill.mode`) are not checked against the allowed list. An unknown slug reaches the renderer as is.

## Changing keys

- Add: add the key with a default to `Settings` and `DEFAULT_SETTINGS`. Nothing else is needed.
- Rename or move to another group: old saved data loses that value and falls back to the default. If the value matters, map the old key in `mergeSettings` before dropping it.
- Change a value's type or unit: treat it as a rename.
- Remove or rename a slug: map the old slug in `mergeSettings`, or saved data keeps a slug the renderer no longer handles.
- Never reuse an old key name with a different meaning.

## Units

- Detection sizes are in source image pixels.
- Style sizes are in the size unit `u` = 1/1000 of the image's long side (`docs/architecture.md`).
- Opacity and dim are 0 to 1. Thresholds and luminance are 0 to 255.

## Keys

### detect

| Key | Type | Meaning |
|---|---|---|
| `method` | `threshold` | Detection method. |
| `target` | `bright` / `dark` | Which side of the threshold forms regions. |
| `thresholdMin`, `thresholdMax` | 0-255 | Threshold range split into `levels` steps. |
| `levels` | 1-8 | Number of threshold steps. 1 uses `thresholdMin` only. |
| `blur` | px of the processed image | Box blur radius before thresholding. |
| `processSize` | px | Long side of the downscaled copy used for detection. |
| `minSize`, `maxSize` | source px | Both box width and height must be within this range. |
| `maxCount` | count | Largest regions kept after merging. |
| `padding` | source px | Added on every side of each box. |

### background

| Key | Type | Meaning |
|---|---|---|
| `dim` | 0-1 | Black overlay outside the boxes. |
| `mono` | boolean | Monochrome outside the boxes. |

### effect

| Key | Type | Meaning |
|---|---|---|
| `invert` | boolean | Invert colors inside boxes. |
| `mono` | boolean | Monochrome inside boxes. |
| `zoom` | 1-4 | Magnification inside boxes, centered on the region. 1 means off. |

### fill

| Key | Type | Meaning |
|---|---|---|
| `mode` | `none` / `solid` / `mesh` | Fill style. |
| `color` | `#rrggbb` | |
| `opacity` | 0-1 | |
| `meshSpacing`, `meshWidth` | u | Grid spacing and line width for `mesh`. |

### stroke

| Key | Type | Meaning |
|---|---|---|
| `enabled` | boolean | |
| `style` | `solid` / `dashed` / `corners` | `corners` draws brackets a quarter of the shorter side long. |
| `color` | `#rrggbb` | |
| `width` | u | |

### lines

| Key | Type | Meaning |
|---|---|---|
| `rule` | `none` / `chain` / `nearest` | `chain`: greedy nearest path from the largest region. `nearest`: each region to its `neighbors` nearest. |
| `neighbors` | 1-5 | Used by `nearest`. |
| `shape` | `straight` / `curve` | |
| `curvature` | -1 to 1 | Control point offset as a ratio of the line length. Sign picks the side. |
| `dashed` | boolean | |
| `color` | `#rrggbb` | |
| `width` | u | |
| `opacity` | 0-1 | |

### marker

| Key | Type | Meaning |
|---|---|---|
| `shape` | `none` / `cross` / `dot` / `circle` | Drawn at the region center. |
| `size` | u | |
| `color` | `#rrggbb` | |

### label

| Key | Type | Meaning |
|---|---|---|
| `enabled` | boolean | |
| `template` | string | Placeholders `{id}` `{x}` `{y}` (center) `{left}` `{top}` `{w}` `{h}` `{area}` `{lum}`. `{x:03}` pads with zeros to 3 digits, `{x:3}` with spaces. Unknown placeholders stay as text. |
| `coordScale` | `pixel` / `percent` | `percent` is 0-100 of the image width (x) and height (y). `area` and `lum` are never scaled. |
| `position` | `top-left` / `inside` / `center` / `bottom-left` | `top-left` is above the box and falls back to inside at the top edge. |
| `size` | u | Font size. |
| `color` | `#rrggbb` | Text color. |
| `background` | boolean | Draw a band behind the text. |
| `backgroundColor` | `#rrggbb` | |
