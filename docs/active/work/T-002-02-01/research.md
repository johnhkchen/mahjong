# T-002-02-01 — Research: render dealt hand on table

Descriptive survey of what exists and what constrains this ticket. No solutions here
(that is design.md).

## 1. The ticket in one line

The app folds a seeded record through core's public entrypoint (`foldRecord`) and the
table shows the player's dealt hand and the dora indicator where the wall-count
placeholder was — the first thing a learner can actually *see*. Advances P1.

Acceptance criteria, itemized:

- (a) `app.ssr.test.ts` asserts the rendered table contains the player's **13 dealt
  tiles** and the **dora indicator** (the placeholder wall-count center is replaced).
- (b) App derives **all table data via the core fold** — no engine logic in `src/app/`.
- (c) `just check` and `just build` pass **with the single-file gate intact**.

`depends_on: [T-002-01-04]` — satisfied: `foldRecord` is committed (f3681e1) and
exported through the barrel. T-002-01-04's review.md §Open concerns states explicitly:
"T-002-02-01 (render-dealt-hand) can now proceed: it reads
`foldRecord({seed, actions: []}).hands[0]` through the barrel."

## 2. What exists in `src/app/` today

Three source files plus one test — the walking skeleton from S-001/S-002-01:

| File | Contents relevant to this ticket |
| --- | --- |
| `src/app/main.ts` | `mount(App, { target: #app })`. Untouched by this ticket's concerns. |
| `src/app/App.svelte` | Owns state: `let seed = $state(1)` (the walking-skeleton boot seed, matching the frozen golden vector), `const wall = $derived(buildWall(seed))`, passes `{wall}` to `Table`. Comment says seed selection becomes a real feature with the game-start ticket. Imports **only from `../core`** (the barrel). Global styles (felt-dark page, centered column) live here. |
| `src/app/Table.svelte` | Stateless presentational component: `let { wall }: { wall: readonly TileId[] } = $props()`. Comment codifies the split: "derived data in via props, markup out … state ownership stays one level up (App)". Renders a CSS-grid table (`grid-template-areas` named by wind: east bottom, south right, west top, north left — riichi counterclockwise seating), four `SEATS` entries (East marked `you`), and a **`.center` div showing `{wall.length}` + "tiles in the wall"** — the placeholder this ticket replaces. |
| `src/app/app.ssr.test.ts` | SSR smoke test via `render` from `svelte/server` (node environment — no DOM). Header comment freezes the testing idiom: "Asserts content (count, labels) and the aria landmark only, never classes or structure, so Table's internals stay free to change." Current assertions: wall count `>${expected}<` where expected is derived by calling `buildWall(BOOT_SEED)` from core inside the test (never typed into markup); each wind name appears exactly once; `aria-label="mahjong table"` present. `BOOT_SEED = 1` is duplicated in the test with a comment: "If the app's seed changes, this is the one place the test learns about it." |

There is no tile-rendering code anywhere in the repo — no tile component, no tile art
(original SVG tile art is its own future concern per CLAUDE.md), no kind-display
helpers in the app.

## 3. What core offers this ticket (all through `src/core/index.ts`)

- `foldRecord(record: HandRecord): TableState` — the fold entrypoint. For this ticket
  the only well-typed record is `{ seed, actions: [] }` (`HandAction = never`); folding
  it yields the freshly dealt table.
- `TableState` — `hands` (seat-indexed tuple, `hands[0]` = East = the player, 13
  `TileId`s **in draw order — never sorted; "sorting is presentation"** per the doc
  comment), `live` (70 tiles post-deal), `dead` (14), `doraIndicator: TileId`,
  `dora: TileKind` (already mapped via `doraKindOf`).
- `kindOf(id: TileId): TileKind` — decode a physical tile to its mpsz kind (`'7m'`,
  `'3z'`…). `TileId` is an integer 0–135 encoded `kindIndex * 4 + copy`, so ascending
  id order is canonical kind order (1m…9m, 1p…9p, 1s…9s, 1z…7z) with copy tiebreak —
  a decodable fact, though the arithmetic is documented as "not part of the public
  contract"; `kindIndexOf(kind)` is the public canonical-order accessor.
- Seat semantics: `Seat` 0–3 = E/S/W/N; Table.svelte's `SEATS` already marks East as
  `you`, consistent with `hands[0]` being the player.
- Golden seed 1 (frozen in record.test.ts): `hands[0] = [64, 53, 95, 45, 86, 118, 50,
  8, 36, 46, 49, 11, 82]`, `doraIndicator = 24` (kind `'7m'`), `dora = '8m'`,
  `live.length = 70`.

## 4. Boundary rules in force

1. **"The action log is the public contract"** (CLAUDE.md): the app consumes core as
   record in → state out. App.svelte already models the pattern (state = seed, view =
   derived); this ticket swaps the derivation from `buildWall` to `foldRecord`.
2. **No engine logic in `src/app/`** (AC b, architecture.md §6): the app may *decode
   for presentation* (existing precedent: it renders `wall.length`) but must not
   re-derive table facts core already exposes. What counts as presentation vs. engine
   logic (e.g. sorting the hand for display, decoding kinds) is a design-phase call.
3. **`purity.test.ts` gates core only** — app files are not scanned; the app-side
   convention (import only from `'../core'`, the barrel) is comment-enforced in
   App.svelte and core/index.ts ("app code imports only from here").
4. **Testing idiom** (app.ssr.test.ts header): content + aria landmarks only, never
   classes or structure; expected values derived by calling core in the test.
5. **Single-file gate**: `just build` = `vite build && node
   scripts/verify-single-file.mjs` (vite-plugin-singlefile inlines everything; the
   script verifies dist/ is exactly one self-contained index.html).
6. **Original tile art only** — but no art exists yet; nothing in this ticket's AC
   demands art, only that the dealt tiles and indicator are *contained* in the render.

## 5. Toolchain and test reality

- Svelte 5.56.4 (runes: `$state`/`$derived`/`$props`), vite 8, vitest 4 in **node**
  environment — app tests are SSR string renders, no jsdom, no client mount tests.
- `just test` globs `src/**/*.test.ts` (core property tests + this one SSR file);
  `just check` = svelte-check (App/Table `.svelte` files) + tsc `-p tsconfig.node.json`
  --noEmit; `just build` as above. Suite at HEAD: 8 files, 51 tests, green.
- SSR output is a plain HTML string — assertions are string containment/regex over
  `body`. Duplicate kinds in a hand (four copies of each kind exist) mean naive
  "contains `7m`" assertions can be satisfied by the wrong element (e.g. the indicator
  vs. a hand tile) — the test design must handle multiset/placement disambiguation.

## 6. Neighboring tickets — the boundary this ticket must not cross

| Ticket | Relationship |
| --- | --- |
| T-002-01-04 fold entrypoint (done) | Producer: `foldRecord` + `TableState` are the entire data source. |
| S-002-02 | This is its only ticket — the story is exactly this render slice. |
| Future game-start ticket | Owns real seed selection (App comment). Boot seed stays 1. |
| Future tile-art tickets | Own the original SVG tile faces; whatever placeholder rendering this ticket ships will be reskinned, so its *shape* (a per-tile element) matters more than its looks. |
| Future draw/discard tickets | Will widen `HandAction` and make the table interactive; this ticket renders a static fold of the empty log. |

Out of scope: opponents' hand contents (facedown/hidden is a design call, but no AC
covers them), discard rivers, draw interaction, seed UI, persistence, service worker,
tile art assets, any core changes (core is frozen for this ticket — everything needed
is already exported).

## 7. Assumptions and open questions for Design

- **Where the fold lives**: App.svelte derives `foldRecord({seed, actions: []})` and
  passes state down (the existing App-owns-state / Table-presents split), vs. Table
  folding internally (would violate the stateless-presentational comment).
- **What Table's props become**: the whole `TableState` vs. narrower fields (player
  hand, indicator, live count). Prop shape decides how much churn later tickets cause.
- **Tile display form**: mpsz kind text (`7m`) in a tile-shaped chip is the zero-art
  option; unicode mahjong codepoints (🀇…) exist but render inconsistently and clash
  with the original-art trajectory. Decoding `TileId → TileKind` for display: in App
  (keeps Table dumb) or in Table (keeps props minimal)?
- **Sort for display**: riichi hands are conventionally shown sorted; core explicitly
  says "sorting is presentation". Sorted display would use `kindIndexOf`/id order —
  is that presentation (fine in app) and does the test then assert sorted order?
- **Center contents**: AC says the wall-count placeholder is *replaced* by the dora
  indicator — does any wall count survive (live remaining = 70 is arguably useful
  table furniture) or does the center become indicator-only?
- **What the other three seats show**: nothing new, tile backs, or counts — no AC
  covers them; smallest slice leaves the wind labels as-is.
- **Test disambiguation**: how app.ssr.test.ts distinguishes the 13 hand tiles from
  the indicator (aria landmarks per region? multiset extraction via regex?) while
  honoring "content and aria only, never classes or structure".
