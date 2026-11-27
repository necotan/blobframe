# CLAUDE.md

## Language rules

- Respond to the user in Japanese.
- Commit messages: first line in English, all following lines in Japanese.
- Write code comments in Japanese.
- Use English for variable names, function names, file names, and settings keys.
- In docs, code comments, and commit messages, use ASCII instead of these symbols. This does not apply to UI text.
  - Arrows: `->` `<-` `=>` `<=>` (not `→` `←` `⇒` `⇔`)
  - Dashes and ellipsis: `-` (not `—` `–`), `...` (not `…`)
  - Math: `x` (not `×`), `~` (not `≒`), `>=` `<=` (not `≥` `≤`)
  - Quotes: `"` `'` (not `“ ”` `‘ ’`)
  - Lists and marks: `1.` `2.` (not `①` `②`), `OK` / `NG` or words (not `✓` `✗` or emoji)

## Project

blobframe: a browser tool that detects regions (blobs) in an image and draws boxes, connecting lines, markers, labels, and in-box effects over them. Images only for now; video is planned (`docs/requirements.md`).

- Vite + React + TypeScript, Tailwind CSS v4, Tweakpane v4 for the settings panel.
- Detection runs in a Web Worker; drawing uses Canvas 2D. No backend.
- Hosting: Vercel (`https://blobframe.vercel.app`), deployed from `main`; pull requests get preview URLs.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run lint`: ESLint (warnings fail too)
- `npm run typecheck`: type check
- There is no test suite.

## After every change

- Run `npm run lint` and `npm run typecheck`; the git `pre-commit` hook runs both.
- For UI changes, check PC, smartphone (portrait and landscape), and tablet layouts, with touch emulation on for touch devices. The layout rules are in `docs/architecture.md` (Layout).
- When changing detection or drawing, check the result with a real image, not only the type check.
- When adding, renaming, or removing a settings key, follow `docs/settings.md`; saved settings and preset files depend on the key names.

## Layout

- `src/App.tsx`: image loading (file, drop, paste), detection and render scheduling, export.
- `src/components/ControlPane.tsx`: the Tweakpane panel. It owns its own copy of the settings and reports changes through `onChange`.
- `src/components/pane/`: Tweakpane customizations. `dropdownPlugin.ts` replaces every list (`options`) with an own dropdown; `folderIcons.ts` and `pane.css` restyle the folder marks. Icons come from `lucide`.
- `src/lib/image.ts`: image loading; shrinks images larger than the device can draw on a canvas (iOS Safari).
- `src/lib/fonts.ts`: reads the app font (`--font-mono` in `src/index.css`, Roboto Mono) for canvas labels and waits for it to load.
- `src/lib/settings.ts`: `Settings` type, defaults, and `mergeSettings` for saved JSON. `src/lib/presets.ts`: built-in presets. `src/lib/exportSettings.ts`: export format, quality, and scale, stored apart from `Settings`.
- `src/lib/detect/`: detection. `detector.ts` (main thread side) downscales the image and talks to `detect.worker.ts`; methods (`threshold.ts`, `quadtree.ts`) are pure functions; helpers shared by methods are in `common.ts`.
- `src/lib/render/`: drawing. `render.ts` draws the layers; `connections.ts` picks line pairs; `label.ts` expands label templates.
- `.githooks/`: `pre-commit` (lint, type check) and `commit-msg` (line 1 format). Enable once per clone: `git config core.hooksPath .githooks`.
- `.claude/`: Claude Code settings (denied git commands) and the Stop hook that runs lint and type check. `settings.local.json` is personal and git-ignored.
- `docs/`: design docs tracked in git. Read the one for the area you change:
  - `requirements.md`: features, roadmap, non-goals
  - `architecture.md`: pipeline, coordinate systems, how to add a detection method or a style option
  - `settings.md`: settings keys, units, saved settings and preset compatibility
- Other files in `docs/` are local-only notes (git-ignored; absent in fresh clones and worktrees). Use them only as a reference when stuck; the code, this file, and the design docs take precedence.
- File names: components in PascalCase, everything else in camelCase.

## Architecture

- MUST keep all image processing in the browser. Never send images to a server; that is the reason the app has no backend.
- Keep detection and drawing separate: detection returns `BlobRegion[]`, drawing only reads them. A style change must not re-run detection. Why: re-detecting on every slider move makes the panel lag, and the split is what lets video reuse the same renderer.
- Do not use `ctx.filter` or per-pixel `getImageData` loops in the renderer; use composite operations (`docs/architecture.md`).
- Change the look of Tweakpane through `src/components/pane/` (a plugin or CSS overrides), not by editing or forking Tweakpane. Use `lucide` for icons; do not add another icon set.

## Comments

- Write only why: the reason for a choice, workarounds for browser or library quirks, and constraints the code alone does not show.
- Do not write what the code or names already say (e.g. "ラベル描画", "〜処理"). If there is no why to explain, write no comment.
- No decorative characters such as `---`, `===`, `***`.
- Use `/** */` above an exported function, type, or prop when callers must know something to use it correctly: rules they must follow, what the return value means, units, or side effects. VS Code shows it on hover at call sites. Put implementation reasons in `//` inside the function, next to the code they explain. Use `//` for all other comments.

## Git workflow

- Do not run `git checkout -b`, `commit`, `push`, PR creation, `merge`, or `pull`. The user runs them.
- At the start of work, propose a branch name (`feature/xxx` or `fix/xxx`). Say no branch is needed only when the change touches nothing that ships: docs, README, CLAUDE.md, or code comments. Changes to UI text, CSS, config, or dependencies need a branch.
- After code changes, run `git status` and `git diff` (plus `git diff --staged` if anything is staged), then propose a commit message based on the actual diff.

## Commit messages

| Prefix | Use |
|---|---|
| fix | Bug fix |
| hotfix | Critical bug fix |
| add | New file or feature |
| update | Feature change (not a bug) |
| change | Spec change |
| clean | Cleanup, refactoring |
| disable | Disable, comment out |
| remove | Remove a file or feature |
| upgrade | Version upgrade |
| revert | Revert a change |

- Line 1: `<prefix>: <summary in English>`.
- The body is optional. For a small change that line 1 fully describes, write line 1 only. Otherwise add a blank line and 1 to about 4 Japanese bullets; do not pad to reach 4.
- Bullets name the concrete files, components, settings keys, or functions changed and how. Do not explain causes or background.
- Only when the user explicitly asks for causes or background, write prose with the root cause (file and line) and the fix approach.

```
fix: label clipped at the right edge of the image
```

```
add: adaptive threshold detection

- detect/adaptive.ts に積分画像による適応的しきい値を追加
- DetectSettings.method に 'adaptive' を追加し、detect.worker.ts で振り分け
- ControlPane の Detect に blockSize と offset を追加し、method に応じて表示を切り替え
```
