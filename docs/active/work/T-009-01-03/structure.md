# Structure: T-009-01-03 furiten-completion

## Files modified (no new files, no deletions)

### `src/core/record.ts`

- **`TableState` interface** (after the `riichi` field, before `pot` — grouped with the
  other riichi-ticket-era per-seat facts): add
  - `tempFuriten: readonly [boolean, boolean, boolean, boolean]`
  - `riichiFuriten: readonly [boolean, boolean, boolean, boolean]`
  each with a doc-comment naming the sealing/clearing rule and cross-referencing this
  ticket, following the existing `riichi` field's comment shape.

- **New private helper**, placed near `windKindOf`/`ROUND_WIND` (used by
  `applyWinTail` today) since it reuses both:
  ```ts
  function completesWithYaku(state: TableState, seat: Seat, tile: TileId): boolean
  ```
  Mirrors `applyWinTail`'s derivation call (`yakuOf` wrapped in try/catch for the
  completion signal, `source: 'discard'`, `lastTile: state.live.length === 0`,
  `seatWind: windKindOf(seat)`, `roundWind: ROUND_WIND`), returns `yaku.length > 0`
  or `false` on the completion throw. Doc-comment notes this is `record.ts`'s own
  restatement, mirroring (never importing) `legal.ts`'s `winYaku`, per both modules'
  independence doctrine.

- **New private helper**, placed directly below `completesWithYaku`:
  ```ts
  function sealPassedWins(state: TableState, discarder: Seat, tile: TileId): void
  ```
  Loops the three non-discarding seats (`(discarder + k) % SEAT_COUNT`), and for each
  where `completesWithYaku` is true: builds fresh copies of `state.tempFuriten` (always
  set true for that seat) and, additionally, `state.riichiFuriten` (set true for that
  seat only when `state.riichi[thatSeat]` already holds) — one fresh-array pass per
  field, assigned back once after the loop (not per-iteration reassignment). No-op
  (returns without allocating) when no seat is eligible — cheap in the common case,
  matching `discardFuriten`'s own performance note.

- **`performDiscard`**: one call to `sealPassedWins(state, seat, tile)` inserted after
  the mustDiscard/tsumogiri/tedashi three-arm `if/else if/else` block (the tile is
  already on the discarder's pond and every OTHER seat's hand is untouched by this
  function), before the trailing `if (state.live.length === 0) { ryuukyoku } else {
  turn/claimable }` tail. Single insertion point covers ordinary discards, claim
  discards, AND the riichi step's own atomic discard (all three funnel through here) —
  as well as both the open-window and ryuukyoku-ending outcomes.

- **`applyAction`'s `'draw'` case**: after `state.drawn = state.live.shift()!`, clear
  `tempFuriten[action.seat]` via the fresh-copy idiom (unconditional reassignment —
  simpler than branching on whether it was already false).

- **`applyKanTail`**: after `state.drawn = state.dead.shift()!`, the same clear for
  `state.turn` (always the kan-performing seat at every one of its three call sites).

- **`foldRecord`**: initialize both new fields to `[false, false, false, false]` in the
  literal `state` object, alongside `riichi: [false, false, false, false]`.

### `src/core/legal.ts`

- **Header** (lines 17-24, "THE FURITEN DIVERGENCE" block): amend the closing line
  ("Temporary and riichi furiten are the riichi ticket's extensions, not this rule") to
  note they are now IMPLEMENTED, fold-tracked, and read here — keeping the paragraph's
  point that the divergence (offered-narrower-than-folds) still holds for all three
  furiten kinds, since `applyRon` gates on none of them.

- **`discardFuriten`'s doc-comment** (line 100): no functional change; add one sentence
  noting it is the BASIC/self-pond member of a three-way OR now composed in
  `ronOffers`, cross-referencing `TableState.tempFuriten`/`riichiFuriten`.

- **`ronOffers`** (line 126): replace
  ```ts
  if (discardFuriten(state, seat)) continue
  ```
  with
  ```ts
  if (discardFuriten(state, seat) || state.tempFuriten[seat] || state.riichiFuriten[seat]) continue
  ```
  Update the function's doc-comment's gate list (currently "the tile completes the
  seat's hand ..., the seat is not furiten (see discardFuriten), and the completion
  carries at least one yaku") to name all three furiten sources.

### `src/core/legal.win.test.ts`

- **`ronGates`** oracle (line 58): fold the two new fold-tracked facts into its
  `furiten` line —
  ```ts
  const furiten =
    waits(kinds, melds).some((kind) => pondKinds.has(kind)) ||
    state.tempFuriten[seat] ||
    state.riichiFuriten[seat]
  ```
  No signature change; every existing call site (`ronGates(state, seat, tile)`) keeps
  working, and the "two-sided win partition" test (line 335) keeps its existing
  assertion shape (`isOffered === completes && !furiten && !yakuless`) — it now
  correctly incorporates the extended gate instead of silently drifting from it.

- **New `describe('temporary and riichi furiten', ...)` block**, added after "the
  furiten divergence: not offered, still folds" (after line 272), with its own frozen
  seed anchors (mined per design.md's plan, comments in the same style as the existing
  "Frozen anchors" block at line 100). Covers:
  - a passed win (non-riichi) seals `tempFuriten` and withholds the ron offer;
  - the SAME seat's next draw clears it, and the ron offer (if the tile is still live
    to test against — likely re-asserting via `legalActions` at the pre-draw and
    post-draw states rather than needing the identical tile to reappear);
  - a passed win while in riichi (reusing/extending `record.test.ts`'s `RIICHI_SEED =
    100` fixture or a freshly mined one local to this file) seals `riichiFuriten`
    permanently — offer withheld before AND after the seat's own next draw;
  - tsumo remains offered for a seat sealed by either furiten kind (no gate on
    `tsumoOffer`);
  - re-folding the same record twice yields identical `tempFuriten`/`riichiFuriten`
    arrays (determinism), a short direct assertion rather than a property test.

### `src/core/record.test.ts`

- **`'riichi declaration folds'` describe block**: no structural change needed: this
  ticket's riichi-furiten fixture lives in `legal.win.test.ts` (the offer/agreement
  layer), since the AC is about `ronOffers`/`legalActions`, not `foldRecord`'s
  mechanics. `record.test.ts` gets one small addition instead — a direct fold-level
  check (not offer-level) that `state.tempFuriten`/`riichiFuriten` are set/cleared at
  the exact fold steps described in design.md, using the existing `RIICHI_SEED`
  fixture and one freshly mined non-riichi temp-furiten seed. Placed as a new
  `describe('furiten tracking', ...)` block after the riichi block (after line 741).

## Ordering

1. `record.ts` (the fold-tracked fields + their two mutation sites) — everything else
   depends on this compiling and folding correctly first.
2. `legal.ts` (the gate composition) — depends on `record.ts`'s new fields existing.
3. Mining script (scratch, not committed) run against the now-real `state.tempFuriten`/
   `state.riichiFuriten` to find the temp-furiten-without-self-furiten seed.
4. Tests in `record.test.ts` (fold-level) and `legal.win.test.ts` (offer-level),
   using the mined seed plus the existing `RIICHI_SEED`.
5. Full suite (`just test`) to confirm the ron/win agreement suite (`legal.win.test.ts`
   in full, plus `legal.test.ts`, `dynamics.test.ts`, `game.test.ts`, `policy.test.ts`
   — anything that folds through `scriptedTurns`-style tsumogiri games and could
   incidentally trip newly-tracked temp furiten) stays green.

## Explicitly out of scope (confirmed in Design, restated here for Plan)

- `SeatView`/`seatview.ts` — no new fields exposed to bots/hints this ticket.
- `policy.ts` — bots already only ever act on `legalActions`' offered set; no change
  needed, but its own test suite is part of the "full suite stays green" check since
  bot decision fixtures also fold real games.
- Any UI/app-layer surface (`src/app/`) — zero-scope; this ticket is core-only.
