# T-002-02-01 — Design: render dealt hand on table

Decisions with rationale, grounded in research.md. Core is frozen for this ticket —
every question here is app-side.

## 1. Where the fold lives — App owns state, Table presents (chosen)

**Chosen**: App.svelte derives the folded state:
`const table = $derived(foldRecord({ seed, actions: [] }))` and passes it down. Table
stays a stateless presentational component.

This is not new design — it is the existing split, comment-enforced in both files
("state ownership stays one level up"), with the derivation swapped from `buildWall`
to `foldRecord`. The record literal `{ seed, actions: [] }` in App is the app-side
embodiment of "the action log is the public contract": the app's authoritative state
is a record (today: a seed and the necessarily-empty log), everything visible is a
fold. When actions arrive in later tickets, `actions` becomes app state and this line
doesn't change shape.

**Rejected — Table folds internally**: Table would need the seed as a prop and would
stop being presentational; violates the documented component contract, and every
future consumer of table state (hints, review) would bypass it anyway.

## 2. Table's prop — the whole `TableState` (chosen)

**Chosen**: `let { table }: { table: TableState } = $props()` — one prop, the folded
state, replacing `wall`.

- `TableState` is core's *documented derived view*, designed to grow (discards, melds,
  turn) "without invalidating any stored hand". Table is the view of exactly that
  view; a single prop means later tickets add fields in core and render sites in
  Table, with **zero prop-plumbing churn** in App.
- App stays a pure state-owner: it holds the record, folds it, hands it over — it
  never picks table state apart (picking fields is view knowledge).

**Rejected — narrow props** (`hand`, `doraIndicator`, `liveCount`, …): the current
`wall` prop's precedent, but it forces App to know which fields the view consumes and
re-plumbs on every ticket. The narrowness bought nothing testable: the SSR test
renders App, not Table, so prop granularity is invisible to it.

## 3. Tile display form — mpsz kind text in a tile-shaped chip (chosen)

**Chosen**: each tile renders as its `TileKind` string (`7m`, `3z`) inside a small
tile-shaped chip (light face, dark text, rounded rect — evoking a tile without
drawing one). Modest per-suit text coloring (m/p/s/z) for legibility, teaching-first.

- mpsz is the engine's own notation and the standard riichi shorthand the teaching
  layer will use anyway; a learner sees the same token the docs/yaku explanations use.
- Zero art assets, so the original-art invariant is untouched and the future tile-art
  ticket has a single obvious reskin point (§5).

**Rejected — Unicode mahjong codepoints (🀇…)**: render inconsistently across
platforms (emoji-font substitution, wrong sizes, missing glyphs), and they *are* tile
faces — third-party glyph outlines standing in where the project has an explicit
original-art trajectory. **Rejected — inline SVG art now**: that is a different
ticket's whole job; smuggling it in here bloats a render-wiring slice.

## 4. Sorting and decoding — presentation, done in the view (chosen)

**Chosen**: Table displays the player's hand sorted in canonical kind order:
`[...table.hands[0]].sort((a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b)))`
(stable sort; draw order preserved within a kind). Kind decoding for display
(`kindOf`) happens where the tile is rendered.

- Core's own doc comments settle the boundary question: hands are "never sorted;
  sorting is presentation" (deal.ts, TableState) — so sorting in the app is not
  engine logic leaking, it is exactly where core says it belongs. AC (b) is satisfied
  *because* the sort uses core's public accessors (`kindIndexOf`, `kindOf`) rather
  than re-deriving order from the id arithmetic (documented as "not part of the
  public contract").
- Riichi hands are conventionally viewed sorted; an unsorted 13-tile row is actively
  hostile to the learner (P1).

**Rejected — sort by raw `TileId`**: same result, but leans on the id encoding core
explicitly keeps private. **Rejected — sort in core / new core helper**: core is
frozen this ticket, and core already ruled sorting out of its scope.

## 5. A `Tile.svelte` component (chosen)

**Chosen**: new `src/app/Tile.svelte` — `let { id }: { id: TileId } = $props()`,
renders the chip of §3. Two call sites today (13 hand tiles, 1 dora indicator).

- Svelte scoped styles don't share across components; without a component the chip
  CSS is duplicated in Table or forced `:global`.
- It is the single reskin point for the future tile-art ticket: art replaces Tile's
  internals; Table and App never change.

**Rejected — inline markup in Table**: fewer files, but duplicated styles between
hand and indicator render sites and no stable seam for the art ticket.
**Rejected — passing decoded kind strings from App**: loses `TileId` identity (needed
for stable `{#each}` keys — duplicate kinds exist in one hand: four copies per kind).

## 6. The center — dora indicator plus remaining-wall count (chosen)

**Chosen**: the center replaces the placeholder ("136 / tiles in the wall") with:
the dora indicator as a Tile chip labeled "dora indicator", plus a secondary line
showing `table.live.length` "tiles left".

- AC (a) demands the indicator where the placeholder was; the placeholder (full
  pre-partition wall count — a number no real table ever shows) dies.
- The remaining-live count (70 post-deal) is real riichi table furniture (every
  client shows tiles-remaining), comes from the same fold, and makes the fold's
  effect visible: 136 was placeholder scaffolding, 70 is game state.

**Rejected — indicator only**: discards useful, already-derived furniture and makes
the center a one-item box. **Rejected — keeping the old count alongside**: 136 is not
a table fact once dealing exists; keeping it contradicts "placeholder replaced".

## 7. The other three seats — unchanged (chosen)

Wind labels stay as they are. No AC covers opponents; facedown tile backs are pure
decoration with no data behind them (their hands exist in `table.hands[1..3]` but
rendering hidden hands as backs is presentation polish for a later slice). Smallest
honest slice: the player's seat gains a hand; everyone else waits for their ticket.

## 8. Test design — multiset of tile tokens, aria landmarks, fold-derived expectations

Rewrite `app.ssr.test.ts` inside its frozen idiom (content + aria only, never classes
or structure; expected values derived by calling core inside the test):

1. **Hand + indicator containment (AC a)**: extract every tile-looking text token
   from the SSR body with `/>([1-9][mpsz])</g` and assert the multiset equals the 13
   kinds of `foldRecord({seed: BOOT_SEED, actions: []}).hands[0]` plus the indicator's
   kind — 14 tokens, no more, no fewer. Multiset comparison (sorted arrays) handles
   duplicate kinds exactly and asserts nothing about markup structure or order. The
   token regex cannot false-positive on other content: wind names are words, counts
   (`70`, `13`) contain no `[mpsz]` suffix at a single digit.
2. **Aria landmarks**: `aria-label="your hand"` and `aria-label="dora indicator"`
   exist — the regions are *named*, not structurally located (screen-reader-honest
   and consistent with the existing `aria-label="mahjong table"` assertion, which
   stays).
3. **Placeholder replaced**: body contains the live-remaining count derived from the
   fold (`table.live.length`) and no longer contains the old placeholder label
   ("tiles in the wall") — content assertions both.
4. **Winds render exactly once each** — kept as-is (guards the seat loop against
   duplication when the east seat grows a hand).
5. `BOOT_SEED = 1` stays the single app/test synchronization point, per its comment.

Not asserted: sorted display order (presentation choice, not AC — asserting token
order would encode source/DOM order, i.e. structure), chip styling, suit colors.

## 9. Risks and mitigations

- **SSR string brittleness**: mitigation is the multiset-of-tokens approach — it
  survives any Table/Tile restructuring that keeps content and aria names.
- **Tile chips overflowing the east grid cell** (13 chips in a 70dvh-square's middle
  column): sized in `rem` with flex-wrap as a fallback; a purely visual concern the
  SSR test rightly ignores; verified by eye via `just dev`.
- **svelte-check strictness on the tuple type** (`table.hands[0]` is `TileId[]` from
  a readonly tuple — fine); the sort copies with `[...]` so no readonly mutation.

## 10. Decision summary

| Question | Decision |
| --- | --- |
| Fold location | App.svelte, `$derived(foldRecord({seed, actions: []}))` |
| Table prop | single `table: TableState` (replaces `wall`) |
| Tile form | mpsz kind text in a chip; new `Tile.svelte`; per-suit text color |
| Sorting | in Table, via public `kindIndexOf`/`kindOf`, stable copy-sort |
| Center | Tile chip for indicator + "dora indicator" label + live count "tiles left" |
| Other seats | untouched |
| Core changes | none |
| Test | multiset of tile tokens + aria region names + placeholder-gone, all fold-derived |
