# T-001-03-01 — Structure: Svelte empty-table view

File-level blueprint for the design in design.md. Five files change (2 modified, 3 new),
nothing is deleted, no config moves.

## 1. File inventory

| File | Action | Role |
| --- | --- | --- |
| `src/app/App.svelte` | **rewrite** | State owner: seed rune → derived wall → renders `<Table>`; page chrome + global reset |
| `src/app/Table.svelte` | **new** | Stateless presentational table: `wall` prop in, seats + wall count out |
| `src/app/app.ssr.test.ts` | **new** | SSR smoke test: rendered markup shows the count derived from core's wall build |
| `src/core/purity.test.ts` | **new** | Boundary gate: no bare/`../` imports in core runtime modules |
| `docs/active/work/T-001-03-01/*` | **new** | RDSPI artifacts |

Untouched (deliberately): `src/app/main.ts`, `src/app/vite-env.d.ts`, `index.html`, all
`src/core/` runtime modules, `vite.config.ts`, `svelte.config.js`, `tsconfig*.json`,
`justfile`, `package.json` (zero new dependencies).

## 2. `src/app/App.svelte` — the state owner

```
<script lang="ts">          // first script block in src/app/
  import { buildWall } from '../core'      // the barrel — the only sanctioned core path
  import Table from './Table.svelte'

  // Arbitrary walking-skeleton seed (matches the frozen golden vector in wall.test.ts);
  // seed selection becomes a real feature with the game-start ticket.
  let seed = $state(1)
  const wall = $derived(buildWall(seed))
</script>
```

Markup shape:

```
<main>
  <header>  — app name, small, out of the table's way
  <Table {wall} />
</main>
```

Style block responsibilities (scoped except where noted):
- `:global(html, body)` — margin 0, background color, `color-scheme`; the two-rule global
  reset design §5 places here instead of a stylesheet file.
- `main` — mobile-first column layout: flex column, min-height 100dvh, centered content,
  system font stack, padding safe for small phones.

App.svelte knows nothing about seats or table geometry — that is Table's job. App's whole
contract: produce `wall` via runes, hand it down.

## 3. `src/app/Table.svelte` — the presentational table

```
<script lang="ts">
  import type { TileId } from '../core'

  let { wall }: { wall: readonly TileId[] } = $props()

  const SEATS = [ ... ] as const   // wind label + grid-area name, East→North
</script>
```

- **Props interface (the component's public contract):** exactly one prop, `wall:
  readonly TileId[]`. Table never builds, sorts, or mutates the wall; `readonly` makes the
  direction structural. Future tickets widen this contract (hands, discards) rather than
  moving state in.
- **Markup:** one root `<section class="table" aria-label="mahjong table">` laid out as a
  3×3 CSS grid:
  - grid areas: `north` top-center, `west` left-middle *(sic — see orientation note)*,
    `center` middle, `east` right-middle... **Orientation (normative):** player = East at
    the **bottom**; counterclockwise riichi seating puts South **right**, West **top**,
    North **left**. Grid areas named by wind, not by screen edge, so the mapping is stated
    once in the `grid-template-areas` string.
  - Each seat: a `<div class="seat seat-{wind}">` with the wind name; East additionally
    carries a `you` marker class + visually distinct treatment (design §5).
  - Center cell: the wall count — text of the shape `wall · {wall.length} tiles`, with
    `{wall.length}` as the only number source. No `TILE_COUNT` import: the display must be
    able to be wrong if the build is (design §1).
- **Style:** scoped. Custom properties (`--felt`, `--felt-edge`, `--ink`) on `.table`;
  `aspect-ratio: 1`, `width: min(100% , 70dvh)` sizing per design §2; border-radius +
  border for the felt edge. No media queries, no external assets, no animation.

## 4. `src/app/app.ssr.test.ts` — render-derivation smoke test

Node-environment vitest (matches existing `environment: 'node'`; no config change).

```
import { render } from 'svelte/server'
import { buildWall } from '../core'
import App from './App.svelte'
```

Assertions (three `it` blocks):
1. **Count is present and derived:** `render(App).body` contains the count string built
   from an *independent* `buildWall(1).length` — not the literal 136 typed twice: compute
   `expected = buildWall(1).length` then assert the markup contains it. (The golden-vector
   freeze makes seed 1 stable; if the boot seed ever changes this test names the one place
   to update.)
2. **All four seats render:** markup contains each wind label exactly once.
3. **Table landmark exists:** the `aria-label="mahjong table"` root is present — the hook
   later table tickets and any future DOM tests select by.

Coupling rule: the test asserts *content* (count, labels), never CSS classes or markup
structure beyond the aria landmark — Table's internals stay free to change.

**Fallback (design §3 risk):** if `svelte/server` render of a `.svelte` import fails under
the pinned vitest, restructure to a plain-TS formatting helper + direct test, recorded as
a deviation in progress.md before proceeding.

## 5. `src/core/purity.test.ts` — the boundary gate

Node-environment vitest using `node:fs`/`node:path` (test-only; tests never ship) plus
`import.meta.dirname` to locate `src/core/`.

Mechanics:
- Enumerate `*.ts` directly in `src/core/` (no subdirectories exist; the scan reads the
  directory rather than a hardcoded file list so future core modules are auto-covered).
- Extract module specifiers with a regex over `import ... from '…'`, `export ... from '…'`,
  and dynamic `import('…')` forms.
- **Rule for runtime modules** (non-`*.test.ts`): every specifier must match `^\./` —
  same-directory relative only. This forbids bare packages (svelte, vite, DOM libs) and
  any `../` escape (`../app` specifically) in one rule.
- **Rule for test files:** `../` still forbidden; bare imports allowed only from an
  explicit allowlist `['vitest', 'fast-check', 'node:...']` — so a test can't quietly
  smuggle a DOM environment into core either.
- One additional assertion: the file scan found a non-empty set including the four known
  modules — guards against the test silently passing on a wrong path.

Placement rationale: it lives in `src/core/` because it *is* a core invariant ("no app or
DOM imports appearing in src/core/" — the AC's words), and core's test suite is where
every later core ticket will trip it.

## 6. Interfaces & dependency graph after this ticket

```
index.html → src/app/main.ts → App.svelte → Table.svelte
                                   │             │
                                   ▼             ▼ (type-only)
                          src/core/index.ts  (barrel)
                                   │
                          tiles.ts  rng.ts  wall.ts     ← purity.test.ts gates this box
```

- Runtime value imports from core: exactly one (`buildWall` in App.svelte).
- Type-only imports from core: exactly one (`TileId` in Table.svelte).
- Both go through the barrel, per its header rule.
- Nothing in `src/core/` changes; the direction is proven by adding consumers, not by
  touching the engine.

## 7. Ordering of changes

Order matters only in one place: **Table.svelte before App.svelte** within the first step
(App imports Table), and the **view before its tests** (tests import App). The boundary
test is independent and could land any time; it lands with the other test for one
verifiable test-commit. Full sequencing, commit boundaries, and verification per step are
plan.md's job.
