# T-003-02-01 — render-ponds-turn-and-phase — Research

Descriptive map of what exists, where, and how it connects. No solutions proposed here.

## The ticket in one line

Grow the stateless Table view to present the facts T-003-01-01 added to the fold — four
ordered discard ponds, active turn, freshly drawn tile, live-wall countdown, ryuukyoku end
state — every one a field read off `TableState`, never derived in the view.

## Dependency state

- **T-003-01-01 (draw-discard-step-function): `phase: done`.** The engine work this ticket
  presents is merged on `main` (commits `c637802`..`5c34019`). Everything the view needs
  already exists in `src/core/record.ts`.
- **T-003-01-02 (legal-actions-surface): still in research.** `legalActions` does NOT exist
  yet and is not a dependency of this ticket. Any mid-hand record used in tests must be
  authored without it.
- **T-003-02-02 (tap-to-discard)** is the sibling that makes the table *interactive*; it
  depends on this ticket. Interactivity, appending actions, and bot tsumogiri are explicitly
  out of scope here — this ticket is presentation only.

## The engine surface (src/core/)

`src/core/index.ts` is the barrel; app code imports only from `../core`.

### TableState (record.ts:58-97) — the fields this ticket renders

All already implemented and tested:

- `ponds: readonly [TileId[], TileId[], TileId[], TileId[]]` — indexed by Seat, **each in
  discard order**; the doc comment states "the order IS the pond's meaning".
- `turn: Seat` — the seat whose action is expected next, advancing E→S→W→N. **Once the hand
  ends it stays at the last discarder** (record.ts:84).
- `drawn: TileId | null` — the tile the turn seat has drawn and not yet discarded, held
  APART from the 13-tile hand; null between turns.
- `phase: 'playing' | 'ryuukyoku'` — ended exactly when `live` is empty; documented as a
  widenable literal union (agari endings come later).
- `live: TileId[]` — the wall countdown source; the view already renders `live.length`.
- Existing fields already rendered: `hands[0]`, `doraIndicator`.

### Fold mechanics relevant to authoring a test record (record.ts:118-213)

- `foldRecord({seed, actions})` → TableState. Empty log = freshly dealt table.
- Turn cycle: `drawn === null` → the turn seat must `{type:'draw', seat}` (tile comes from
  `live[0]`, never recorded); `drawn !== null` → the turn seat must
  `{type:'discard', seat, tile}` — either the drawn tile itself (tsumogiri, hand untouched)
  or a hand tile (tedashi: hand tile leaves, drawn tile appended to hand).
- After a discard with the live wall empty → `phase = 'ryuukyoku'`; otherwise turn advances.
- Any illegal action throws `RangeError` naming its index — a hand-authored test record must
  be strictly legal.

### Deal and wall constants (deal.ts, wall.ts)

- `Seat = 0 | 1 | 2 | 3` (E, S, W, N); `SEAT_COUNT = 4`; `STARTING_HAND_SIZE = 13`.
- Post-deal live wall = 122 − 52 = **70 tiles**. A full tsumogiri hand is therefore exactly
  70 draw/discard pairs (140 actions) ending in ryuukyoku.
- Consequence for record authoring: the tile drawn on the k-th turn of an all-tsumogiri
  prefix is `foldRecord({seed, actions: []}).live[k]` — draws consume the post-deal live
  wall head-first, so a legal script can be computed from the empty fold alone.

### Tile accessors (tiles.ts)

`kindOf(id)`, `kindIndexOf(kind)`, `suitOf(kind)` are public; kinds are mpsz notation
(`"1m"`..`"7z"`). The view and its tests speak kinds, never raw ids.

## The view surface (src/app/)

### App.svelte — composition root

Holds the authoritative record as `let seed = $state(1)` and
`const table = $derived(foldRecord({ seed, actions: [] }))`. The action log is empty and
stays empty until T-003-02-02; App passes the folded `table` to Table as its one prop.

### Table.svelte — the component this ticket grows

- Stateless presentational: `let { table }: { table: TableState } = $props()`. Header
  comment pins the rule this ticket must keep: "It never derives game facts — every fact
  below is a field read off the fold." The one allowed computation is the display sort of
  the player's hand (core assigns sorting to presentation).
- `SEATS` const array of `{ wind, area, you }` in E, S, W, N order — index-aligned with
  `Seat`, though the current markup never uses the index. Riichi seating is mapped once in
  `grid-template-areas`: East bottom (player), South right, West top, North left.
- Currently renders: wind label per seat, "you" mark, the player's sorted 13-tile hand
  (`aria-label="your hand"`), and a center panel with the dora indicator
  (`aria-label="dora indicator"`) and the wall counter (`{table.live.length} tiles left`).
- Renders NOTHING yet for: ponds, turn, drawn tile, phase. Opponent hands are not rendered
  at all (no face-down backs — no ticket has asked for them).
- Styling: scoped CSS with felt palette custom properties; seats are flex columns inside the
  3×3 grid.

### Tile.svelte — presentational leaf

`TileId` in, one `<span class="tile suit-{suit}">{kind}</span>` chip out. Reusable as-is for
pond tiles and the drawn tile; a future tile-art ticket replaces its internals only.

## The test surface

### app.ssr.test.ts — the file the AC names

- Renders through `svelte/server`'s `render(App)` (real Svelte compiler, `environment:
  'node'`, no DOM emulation — vite.config.ts includes `src/**/*.test.ts`).
- Pinned conventions (header comment): assert **content and aria landmarks only, never
  classes or structure**, so component internals stay free to change.
- Existing helpers/assertions: `tileTokensOf(body)` regexes every `>([1-9][mpsz])<` token;
  tests assert multiset equality of rendered tiles vs the fold, aria labels, the wall-count
  string, one occurrence of each wind word, and the table landmark.
- The tile-multiset test counts ALL tile tokens in the body — any new tile-rendering region
  affects it only for records whose ponds/drawn are non-empty (App's record has empty
  actions, so the existing tests' expectations still hold, but new mid-hand renders need
  region-scoped extraction rather than whole-body token counts).
- `render` accepts props (`render(Component, { props })`), so the test file can render
  Table directly with a hand-authored folded state, or App if App ever takes a record prop.

### Wind-word counting constraint

The existing test asserts each of 'East'/'South'/'West'/'North' appears **exactly once** in
the SSR body. Any new per-seat labels (pond names, turn marker text) that repeat the wind
words in the same casing would break it; new labels must either reuse the single existing
wind text node or use distinct casing/wording (the regex-free `body.split(wind)` count is
case-sensitive).

## Architecture constraints that bind this ticket

- architecture.md §6 / CLAUDE.md: `src/app/` is a thin Svelte 5 view with runes; the app
  re-derives table state by folding after every action; the table DOM is small so
  re-render is cheap. `core/` never imports app.
- Invariants: table state is always derived by folding; the view never becomes a second
  authority. Ponds/turn/drawn/phase must be read, not recomputed (e.g. the view must not
  infer ryuukyoku from `live.length === 0` — it reads `phase`).
- Teaching-first (vision.md P1/P4): the ticket advances P1 (a legible real table) and P4
  (legibility/teaching) — ponds in discard order are the future safe-tile-reading surface.

## Assumptions surfaced

- Opponents' drawn tiles are concealed information at the table; nothing in TableState marks
  them secret — concealment is a presentation decision the view has to make.
- The AC's "active seat is marked" and "ryuukyoku end state" specify no particular markup —
  the SSR-testable convention in this repo is an aria attribute or visible text.
- `docs/active/work/T-003-02-01/` did not exist before this research; sibling
  T-003-01-01's work dir shows the six-artifact layout this ticket follows.
