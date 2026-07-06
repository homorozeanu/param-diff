# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # Vite dev server at http://localhost:5173
npm run build             # tsc -b && vite build → single self-contained dist/index.html
npm run preview           # serve the built bundle
npm test                  # vitest run (one-off, used by CI)
npm run test:watch        # vitest watch mode
npm run test:coverage     # v8 coverage (text + json-summary reporters)
```

Run a single test file: `npx vitest run src/parse.test.ts`
Run a single test by name: `npx vitest run -t "decodes once"`

Node 22+ required; `.nvmrc` pins Node 24 for local + CI (CI reads `node-version-file: .nvmrc`, so bumping `.nvmrc` bumps CI).

## Architecture

Single-page React 19 + TypeScript app, built by Vite with `vite-plugin-singlefile` so `npm run build` emits **one ~210 KB `dist/index.html`** (~65 KB gzipped) with all JS and CSS inlined — that file is the shipped artifact (attached to GitHub Releases by `.github/workflows/release.yml` on `v*.*.*` tags). No backend, no runtime network. The only persistence is per-tab `sessionStorage` (see Persistence below) — nothing leaves the browser.

### The param tree

The core data structure is a recursive `Param` tree (`src/types.ts`). Each `Param` keeps both `rawValue` (immutable, for Reset) and `value` (current displayed text), plus a `decodeCount` and an `expanded` flag. When expanded, `nestedParams` holds child `Param`s — children have the same shape and operations, so any UI/logic that handles one level handles all levels.

`src/parse.ts` is the only place that mutates this tree. All operations return new `Param` objects (never mutate in place):

- `decodeParam` — applies one `decodeURIComponent` pass; no-op if expanded or already fully decoded.
- `expandParam` — splits a value at the first `?` and parses the rest as `key=value` pairs, but only when `looksExpandable` agrees. Bare query strings (`a=1&b=2` with no `?`) are accepted only when every key matches `/^[A-Za-z0-9_\-.]+$/`, to avoid false positives on prose.
- `resetParam` — restores `rawValue` and collapses any expansion.
- `updateParamById` — walks the tree to find a param by id and applies an updater immutably; this is how `App.tsx` dispatches a single-param edit without re-parsing the whole URL.
- `flatten` — projects the tree to `{ keyPath, value }[]` for diffing. Dotted paths (`returnUrl.client_id`) for nested keys; expanded parents emit a synthetic `<path> (base)` entry for the prefix portion.
- `reserveIds` — walks a restored tree and advances the module-global `idCounter` past the highest `p<N>` id found. Param ids are a process-global sequential counter (`nextId`), reset to 0 on page load and **not** content-derived — so persisted state must be rehydrated verbatim (never re-parsed) and `reserveIds` called on it, or later `makeParam` calls (e.g. a post-restore Expand) would mint colliding ids and break `updateParamById`.

### State and component flow

`App.tsx` owns an array of `Slot { id, raw, parsed }` (1–4 entries, `MAX_URLS = 4`; `Slot`/`Snapshot` types live in `src/types.ts`). Editing a URL re-runs `parseUrl` for that slot only. Per-row Decode/Expand/Reset clicks bubble up as `(slotIdx, paramId)` and route through `mutateParams` → `updateParamById` → the matching `parse.ts` operation, so the param tree is the single source of truth and the diff recomputes via `useMemo` over `parsedUrls`.

`App.tsx` also owns a `Snapshot[]` history. **Save comparison** deep-clones the current slots into a snapshot; the `HistoryPanel` component (below `DiffView`) lists them with Restore/Delete. Restore deep-clones a snapshot's slots back into state and calls `reserveIds` on each. **Reset all** (`confirm()`-guarded, enabled only when `hasContent || history.length > 0`) sets `slots` back to one `emptySlot()` and `history` to `[]`; the diff and both `sessionStorage` keys clear implicitly via the derived `parsedUrls` memo and the `[slots]`/`[history]` writer effects.

Components are thin and recursive where needed:
- `UrlInput` — textarea + remove button for one slot.
- `ParamList` — table wrapper for one URL's top-level params.
- `ParamRow` — recursive: renders itself, then renders child `ParamRow`s when `expanded`, threading the same `onDecode/onExpand/onReset` callbacks through.
- `DiffView` — calls `flatten` on each `parsedUrl`, builds a union of `keyPath`s in first-seen order, then renders one row per key with one cell per URL (green/red/grey by equality/missing).
- `HistoryPanel` — collapsible list of saved `Snapshot`s; renders nothing when history is empty. Maps each snapshot to a `HistoryEntry` (container/item split mirroring `ParamList`/`ParamRow`).
- `HistoryEntry` — one saved-comparison row (timestamp + URL preview, own `formatTime`/`preview` helpers) with Restore/Delete buttons that bind the snapshot id.

A consequence worth knowing: **the diff reflects whatever decode/expand state the user has applied** — diffing two URLs fairly requires peeling them the same number of times. This is intentional, not a bug.

### Theme

`App.tsx` reads/writes `document.documentElement.dataset.theme` and `localStorage['theme']`; `getInitialTheme()` falls back to `prefers-color-scheme`. `styles.css` is the only stylesheet (no UI framework).

### Persistence

`src/session.ts` is the only module that touches storage, all via **`sessionStorage`** (per-tab: survives reload, cleared on tab close, not shared across tabs) — separate from theme's `localStorage`. Every access is wrapped so corrupt data / quota / disabled storage degrade to a safe default. Two `.v1`-versioned keys: `paramdiff.current.v1` (live `Slot[]`) and `paramdiff.history.v1` (`Snapshot[]`, capped at `MAX_HISTORY = 20`). `App.tsx` follows the same lazy-`useState` + writer-`useEffect` idiom as theme (`getInitialSlots`/`loadHistory` readers, `saveCurrent`/`saveHistory` writers). Restore hydrates verbatim + `reserveIds` — see the param-tree section for why re-parsing on restore would corrupt ids.

## Testing

Vitest with `jsdom`, configured inline in `vite.config.ts` (the same file is both the build and test config). Tests are co-located: `parse.test.ts` next to `parse.ts`, `ParamRow.test.tsx` next to `ParamRow.tsx`. Shared setup in `src/test/setup.ts` registers `@testing-library/jest-dom` matchers and runs `cleanup()` after each test.

Component tests favour behaviour over markup — render, drive with `userEvent`, assert via `screen.getByRole` / `getByText`. **Snapshot tests are deliberately avoided.** `tsc -b` (run by `npm run build`) type-checks tests alongside source, so a type error in a test fails the build.

CI (`.github/workflows/ci.yml`) runs `npm run test:coverage` then pipes `coverage/coverage-summary.json` through `jq` into `$GITHUB_STEP_SUMMARY` to render a markdown coverage table on the run page — no third-party coverage service.

## Releases

Push a `v*.*.*` tag → `.github/workflows/release.yml` builds the single-file bundle and attaches `dist/index.html` (plus a `.gz` variant) to a GitHub Release. The release workflow also accepts `workflow_dispatch` with a `tag` input.
