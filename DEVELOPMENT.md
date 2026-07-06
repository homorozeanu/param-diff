# Developing ParamDiff

This document covers building, contributing, and the internals. End users only need [README.md](README.md).

## What it does

- **Paste 1 to 4 URLs.** Each URL gets its own block; query parameters are extracted into a table.
- **Decode (per param, repeatable).** One click peels one `decodeURIComponent` layer. Click again for double-encoded values (e.g. `%253A` → `%3A` → `:`). The button disables once nothing further would change.
- **Expand (per param).** If a value looks like a URL or query string with its own params (`?a=1&b=2` or `a=1&b=2`), Expand splits it into nested rows, indented under the parent. Nested rows have their own Decode/Expand/Reset buttons, so you can drill arbitrarily deep.
- **Reset (per param).** Puts a row back to its original raw value and collapses any expansion.
- **Unified diff.** When two or more URLs have content, the Diff section shows one row per parameter key (using dotted paths like `returnUrl.client_id` for nested params), with one cell per URL. Cells are color-coded:
  - green = identical across all URLs
  - red = differs
  - grey = missing in that URL
- The diff reflects whatever decode/expand state you've applied — peel both URLs the same number of times to compare like-with-like.
- **Save & revert.** **Save comparison** snapshots the current slots (URLs plus their decode/expand state) into a **Saved comparisons** panel below the diff; each row offers Restore and Delete. The in-progress comparison auto-persists and saved snapshots are kept — both in `sessionStorage`, so they survive a reload but clear on tab close and are per-tab only. History is capped at 20 snapshots.

## Prerequisites

Node 22 or newer. The repo pins Node 24 via `.nvmrc` for local development — `nvm use`, `fnm use`, or `volta` will pick it up automatically — while `package.json` declares `"engines": { "node": ">=22" }` as the minimum supported. CI reads the version from `.nvmrc`, so bumping the local target also bumps CI.

## Run from source

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produces a single self-contained dist/index.html
npm run preview  # serve the built bundle
```

The production build is one ~210 KB HTML file (~65 KB gzipped) with all JS and CSS inlined — no external assets, openable directly from disk.

## Releases

Pushing a tag matching `v*.*.*` triggers the [release workflow](.github/workflows/release.yml), which builds the single-file bundle and attaches `index.html` (plus a gzipped variant) to a GitHub Release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Stack

- **Vite + React 19 + TypeScript** — single-page app, no backend.
- Plain CSS, no UI framework.
- Zero runtime dependencies beyond React.

## Project layout

```
src/
  main.tsx                  # React entry
  App.tsx                   # 1–4 URL slots, wiring, diff, save/restore history
  parse.ts                  # parseUrl, decodeOnce, looksExpandable, splitQuery,
                            # decodeParam, expandParam, resetParam, flatten, reserveIds
  session.ts                # sessionStorage IO for current slots + saved snapshots
  types.ts                  # Param, ParsedUrl, Slot, Snapshot
  styles.css                # Dark theme
  vite-env.d.ts             # Ambient Vite client types (CSS imports, etc.)
  components/
    UrlInput.tsx            # Single URL textarea + remove
    ParamList.tsx           # Table wrapper for one URL's params
    ParamRow.tsx            # Recursive row with Decode/Expand/Reset
    DiffView.tsx            # Unified diff table across active URLs
    HistoryPanel.tsx        # Collapsible saved-comparisons list (Restore/Delete)
```

## Persistence

Per-tab only, via `sessionStorage` (theme uses `localStorage` separately). `src/session.ts` is the single place that touches storage; every access is wrapped so corrupt data, quota errors, or disabled storage degrade to a safe default rather than throwing. Two keys, both `.v1`-versioned: `paramdiff.current.v1` (the live `Slot[]`) and `paramdiff.history.v1` (a `Snapshot[]`, capped at `MAX_HISTORY = 20`).

`App.tsx` mirrors the theme idiom — a lazy `useState` initializer reads storage, a `useEffect` writes on change. On restore the stored param trees are rehydrated **verbatim**, never re-parsed: param `id`s come from a module-global counter in `parse.ts` that resets on page load, so re-parsing would mint colliding ids and break `updateParamById`. `reserveIds` walks a restored tree and advances that counter past the highest `p<N>` seen, so params created after a restore (e.g. a later Expand) stay collision-free.

## Testing

Vitest (jsdom environment) drives both unit tests for `parse.ts` and component tests written with React Testing Library and `@testing-library/user-event`.

```bash
npm test                # one-off run (used by CI)
npm run test:watch      # watch mode for local iteration
npm run test:coverage   # v8 coverage report
```

Tests are co-located with the code they cover — `parse.test.ts` next to `parse.ts`, `ParamRow.test.tsx` next to `ParamRow.tsx`, etc. Shared setup lives in `src/test/setup.ts` and registers `@testing-library/jest-dom` matchers plus a per-test `cleanup`.

Component tests favour behaviour over markup: render the component, drive it with `userEvent`, then assert via `screen.getByRole` / `getByText`. Snapshot tests are deliberately avoided.

`tsc -b` (run as part of `npm run build`) type-checks the test files alongside the source, so a type error in a test will fail the build.

### Coverage in CI

The CI workflow runs `npm run test:coverage`. The v8 provider emits two reporters:

- `text` — a per-file table in the job log.
- `json-summary` — `coverage/coverage-summary.json`, which a follow-up CI step pipes through `jq` into a markdown table written to `$GITHUB_STEP_SUMMARY`. Totals show on the run summary page without any third-party service.

The `coverage/` directory is gitignored.
