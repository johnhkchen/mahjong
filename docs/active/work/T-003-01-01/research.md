# T-003-01-01 — Research: draw-discard-step-function

Descriptive survey of what exists and what constrains this ticket. No solutions here
(that is design.md).

## 1. The ticket in one line

Widen `HandAction` from `never` to a real draw/discard vocabulary, grow `TableState`
with per-seat ponds, a turn pointer, the drawn tile, and a phase, and replace
`foldRecord`'s non-empty-log guard with a per-action step that advances E→S→W→N turns
and ends the hand in ryuukyoku when the live wall empties. Engine only — the tap-to-
discard view is a separate story (T-003-02-*), legality surface is T-003-01-02, and the
dynamic property suite is T-003-01-03. Advances P1, P5.

Acceptance criteria, itemized:

- (a) `just test` green with new record tests: folding interleaved draw/discard actions
  yields the expected **ponds, turn pointer, and drawn tile**.
- (b) A record that drains the live wall folds to an **ended/ryuukyoku phase exactly
  when live is empty**.
- (c) Folding a **wrong-seat action**, a **discard of a tile not in hand**, or a **draw
  out of sequence** throws loudly instead of folding silently.

`depends_on: []` — nothing gates this; it is the critical-path ticket of S-003-01
(both siblings depend on it).

## 2. The module this ticket rewires: `src/core/record.ts`

The contract layer. Three exports, all consumed through the barrel `src/core/index.ts`:

- **`HandAction = never`** (line 20) — deliberately empty, documented as "the extension
  point": *"the action encoding, once defined, becomes part of the replay contract and
  must be designed by the tickets that own it."* This ticket IS that ticket.
- **`HandRecord`** — `{ seed: number; actions: readonly HandAction[] }`. Seed domain is
  integers [0, 2^32); external validation is deferred to a future log-parser boundary.
- **`TableState`** — explicitly documented as *"a DERIVED VIEW, not a frozen contract:
  … this shape may grow fields (discard piles, melds, turn) in later tickets without
  invalidating any stored hand."* Growing it is sanctioned. Current fields: `hands`
  (seat-indexed tuple of 4×13 `TileId[]` in draw order, never sorted), `live` (70 tiles
  post-deal, `live[0]` is the dealer's first draw), `dead` (14, frozen layout),
  `doraIndicator: TileId`, `dora: TileKind`.
- **`foldRecord(record): TableState`** — builds wall from seed, partitions, deals, and
  currently throws `RangeError` on ANY non-empty log. The guard's doc comment names its
  own replacement: *"The non-empty-log guard IS the step function for an empty action
  vocabulary … Action tickets replace it with the real per-action step."* Guiding rule
  quoted there: *"an action the engine cannot interpret must never fold silently into a
  wrong state (the nextInt precedent — corruption fails loudly)."*

## 3. Upstream engine facts the step function composes

- **`deal.ts`** — `Seat = 0 | 1 | 2 | 3` (0 = East the dealer, E/S/W/N order, same
  ordering the honor kinds 1z–4z anchor), `SEAT_COUNT = 4`, `STARTING_HAND_SIZE = 13`,
  `DEAL_SIZE = 52`. `dealHands(live)` returns four 13-tile hands + the 70-tile
  remainder. *"The dealer's 14th is the first draw of play, not deal"* — so the very
  first action of every hand is East's draw of `live[0]`.
- **`wall.ts`** — `LIVE_WALL_SIZE = 122`, `DEAD_WALL_SIZE = 14`. The dead wall is
  untouched by this ticket (rinshan/kan are out of scope per E-003).
- **`tiles.ts`** — `TileId` is an integer 0–135; *"No runtime range checks here — ids
  entering from outside the program (action logs) are validated by the log parser at
  that boundary."* The fold validates *semantics* (tile is in hand), not id ranges.
- **`rng.ts`** — the loud-guard precedent: engine-internal corruption throws
  `RangeError` with a descriptive message (`nextInt`, `dealHands`, `partitionWall`,
  today's foldRecord guard all follow it).
- **Live wall arithmetic**: 70 draw-able tiles after the deal. 70 draws + 70 discards
  = a maximal 140-action log; the last (70th) drawer is seat (69 mod 4) = 1 = South.

## 4. Downstream consumers that must keep working

- **`src/app/App.svelte`** — `const table = $derived(foldRecord({ seed, actions: [] }))`;
  comment notes the log is "necessarily empty until action tickets widen HandAction."
  Passing an empty log must keep yielding the dealt table.
- **`src/app/Table.svelte`** — stateless, takes `{ table }: { table: TableState }`;
  reads `hands[0]`, `dora`/`doraIndicator`, and the live-wall count. **Adding** fields
  to `TableState` is non-breaking for it; changing existing field meanings is not.
- **`src/app/app.ssr.test.ts`** — SSR smoke test folds `{ seed: BOOT_SEED, actions: [] }`
  and asserts rendered content. Unaffected by additive growth.
- **T-003-01-02 (legal-actions-surface)** — will need, for each folded state, the set
  of actions the step accepts. Its agreement test can drive `foldRecord` with extended
  logs, but the shape of the step function affects how cheap that test is.
- **T-003-01-03 (turn-loop-property-suite)** — conservation across random legal
  sequences: *"hands + ponds + live + dead always partition exactly 136 distinct tile
  ids at every prefix"* — note the epic's conservation identity enumerates ponds, so
  wherever the drawn tile lives it must be countable.

## 5. Tests that exist today and will be disturbed

`src/core/record.test.ts` (7 tests, all green):

1. *Empty-log fold = explicit composition* — builds an `expected: TableState` literal
   and `toEqual`s the fold. **Breaks on any field addition** (toEqual is exact); must
   learn the new fields' post-deal values.
2. *Same seed → identical deal* — unaffected.
3. *Fresh arrays per fold* — asserts `hands`/`live`/`dead` freshness; new array-valued
   fields (ponds) will want the same assertion.
4. *Does not mutate the record* — snapshot-compare of `record.actions`; with real
   actions in the log this test gets strictly more interesting.
5. *Conserves 136 tiles across hands + live + dead* — the identity grows terms.
6. *Rejects a non-empty log* — **semantically inverted by this ticket**: a well-formed
   non-empty log must now fold; only malformed/illegal ones throw.
7. *Frozen golden for seed 1* — hands/live-prefix/dead/indicator/dora literals, marked
   "Never regenerate." Must keep passing verbatim; empty-log fold behavior is frozen.

Test idioms in force: `fc` property style with `seedArb = fc.integer({min: 0, max:
0xffffffff})`, `recordOf(seed)` helper, vitest + fast-check only (enforced by
`purity.test.ts`'s import allowlist — runtime modules may import only `./` siblings).

## 6. Constraints and boundary rules in force

- **Replay-contract freeze discipline**: rng stream, wall orientation, dead-wall
  layout, deal map are frozen with golden tests. The action encoding defined here joins
  that contract the moment it lands — its shape is permanent, per record.ts's own
  comment. Design must be conservative.
- **Purity gate** (`purity.test.ts`): record.ts may import only `./` siblings; tests
  only vitest/fast-check/node:.
- **Architecture invariants** (CLAUDE.md / architecture.md §1–2): state is always
  derived by folding; the log is the public contract; replay/undo/review are folds
  over prefixes — so the step must be a pure function of (state, action), no RNG, no
  hidden state, deterministic forever.
- **Out of scope per E-003**: calls, riichi, agari, shanten, yaku, scoring, bots, text
  serialization, persistence, and the view. Also kan ⇒ the dead wall and dora flips
  stay inert; `live` empties fully (no haitei-count subtleties from replacement draws).
- **Hands stay in draw order** — "never sorted; sorting is presentation" (deal.ts,
  Table.svelte both codify it). Where a drawn tile enters the hand array is therefore
  contract-relevant, not cosmetic.

## 7. Open questions carried to Design

- **Action encoding**: does `draw` carry a payload (seat? the drawn tile?) or is it
  bare? The wrong-seat AC implies actions carry the acting seat; whether draw also
  records the tile (redundant with the seed-derived wall) is a redundancy-vs-
  corruption-detection tradeoff.
- **Where the drawn tile lives**: 14th element of `hands[turn]` vs. a separate
  `drawn` field; interacts with the conservation identity, draw-order preservation,
  and what "discard from hand" means mechanically.
- **Phase vocabulary**: minimal (`playing`/`ryuukyoku`) vs. anticipating future
  endings; the ticket says "ended/ryuukyoku phase."
- **Ryuukyoku trigger point**: after the discard that follows the last draw (live
  empties on draw; hand ends when that turn's discard completes) — exact ordering must
  be pinned so "exactly when live is empty" is unambiguous.
- **Step function visibility**: internal detail of foldRecord vs. exported — affects
  how T-003-01-02 writes its agreement test.
- **Error type/messages**: RangeError precedent vs. a dedicated error for illegal
  actions (corrupt log ≠ engine bug).
