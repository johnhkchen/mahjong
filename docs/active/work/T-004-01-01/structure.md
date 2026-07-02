# T-004-01-01 — chi-pon-claim-fold-semantics — Structure

The shape of the change: which files move, what their public faces become, and the
order that keeps every intermediate commit green.

## Files

| File | Change |
|---|---|
| `src/core/record.ts` | **Modified** — the whole ticket's production surface (~+120 lines) |
| `src/core/record.test.ts` | **Modified** — two state literals updated; new claim suites (~+180 lines) |
| `src/core/index.ts` | Untouched — `export * from './record'` already re-exports the new names |
| `src/core/legal.ts`, `legal.test.ts` | Untouched — offers are T-004-01-03; draw/discard legality is unchanged at every state these suites reach |
| `src/core/dynamics.test.ts` | Untouched — trajectories come from `legalActions`, which never emits a claim yet |
| `src/app/*` | Untouched — TableState growth is additive; `just check` proves it |

No files created or deleted. No new module: claim semantics are step semantics and live
where the step lives (design.md D5).

## record.ts — internal organization after the change

Order within the file (existing layout preserved, new blocks slotted in):

1. **Imports** — `rankOf`, `suitOf` join the existing `kindOf` import from `./tiles`.

2. **`HandAction`** grows two members (extend-only; doc block gains the claim
   conventions — claimed tile + uses are deliberate redundancy per the seat-tag
   precedent, uses are physical ids in recorded order):

   ```ts
   | { readonly type: 'chi'; readonly seat: Seat; readonly tile: TileId;
       readonly uses: readonly [TileId, TileId] }
   | { readonly type: 'pon'; readonly seat: Seat; readonly tile: TileId;
       readonly uses: readonly [TileId, TileId] }
   ```

3. **`Meld`** — new exported interface, placed between `HandRecord` and `TableState`
   (it is part of the derived view, not the record):

   ```ts
   export interface Meld {
     readonly type: 'chi' | 'pon'
     readonly claimed: TileId   // stays counted in ponds[from]; (from, claimed) IS the pond mark
     readonly from: Seat
     readonly own: readonly [TileId, TileId]  // spliced from the caller's hand, recorded order
   }
   ```

4. **`TableState`** grows three fields (docs updated in place):
   - `melds: readonly [Meld[], Meld[], Meld[], Meld[]]` — per-seat exposed melds in
     claim order; fresh arrays per fold.
   - `claimable: { readonly seat: Seat; readonly tile: TileId } | null` — the fresh
     discard open to claims; set by any discard that leaves the hand `playing`,
     cleared by the next draw or a claim.
   - `mustDiscard: boolean` — true exactly from a claim until the caller's discard.
   - The conservation doc on `drawn` widens to name the new zone: every id lives in
     exactly one of **hands / melds.own / ponds / drawn / live / dead** (claimed meld
     tiles are the pond's; `Meld.claimed` references, never counts).

5. **Module-local claim helpers** (above `applyAction`; not exported — extraction is
   T-004-01-03's option once a second consumer exists):
   - `isRun(a: TileKind, b: TileKind, c: TileKind): boolean` — one numbered suit,
     ranks a permutation of three consecutive values (honors fail on `rankOf === null`).
   - `applyClaim(state, action, index): void` — shared chi/pon path; the switch cases
     delegate. Guard order is FIXED (each test provokes exactly one guard):
     1. window: `claimable === null` → "…with no claimable discard to claim"
        (covers both never-discarded and stale-after-draw);
     2. seat — chi: `seat !== (claimable.seat + 1) % 4` → "…only seat X may chi
        seat D's discard"; pon: `seat === claimable.seat` → "…of its own discard";
     3. tile: `tile !== claimable.tile` → "…but the claimable discard is tile C";
     4. uses distinct: `uses[0] === uses[1]` → "…uses tile U twice";
     5. uses held: each `hands[seat].indexOf` miss → "…which seat S does not hold"
        (validate BOTH before splicing either — guard-then-mutate, house style);
     6. shape — chi: `!isRun(kindOf(tile), kindOf(uses[0]), kindOf(uses[1]))` →
        "…do not form a run"; pon: kinds not all equal → "…do not form a triplet".
     On success: splice both `uses` out of `hands[seat]`; push
     `{type, claimed: tile, from: claimable.seat, own: uses}` onto `melds[seat]`;
     `turn = seat`; `claimable = null`; `mustDiscard = true`.
     All throws: ``RangeError(`action ${index}: …`)``, matching the existing voice.

6. **`applyAction` amendments**:
   - `case 'draw'`: new guard *after* the turn check — `mustDiscard` set →
     "draw out of sequence — seat S owes a discard for its claim"; on success also
     `claimable = null` (the staleness rule).
   - `case 'discard'`: a new first arm — when `mustDiscard`: the tile must be in
     `hands[turn]` (there is no drawn tile; miss → "…which seat S does not hold —
     a claim discard comes from the hand"), splice to pond, clear `mustDiscard`.
     The existing drawn-tile arms are untouched. Both arms end identically: when the
     hand stays `playing`, `claimable = {seat: action.seat, tile: action.tile}`;
     the ryuukyoku flip leaves `claimable` null (ended states offer nothing).
   - `case 'chi'` / `case 'pon'`: delegate to `applyClaim`.
   - The `default` arm is untouched (the `'riichi'` corruption test still lands there).

7. **`foldRecord`** — initial state gains `melds: [[], [], [], []]`,
   `claimable: null`, `mustDiscard: false`.

## record.test.ts — organization of the new coverage

Existing edits (literal-only):
- The empty-log full-TableState literal (`folds an empty action log…`) gains the three
  new fields with their initial values.
- No other existing test changes: tsumogiri records never claim, hands stay 13,
  `toEqual`-between-folds tests compare like with like.

New frozen scenario constants (top of a new describe region, literals hand-derived
from the frozen seed-1 goldens plus a scratchpad scan at implement time, with
derivation comments per the "never regenerate" precedent):
- **CHI anchor (seed 1, in-context derivable today):** East draws `100` (8s) and
  tsumogiris; South chis with `uses: [98, 106]` (7s + 9s).
- **PON anchor (seed 1):** East draws `100`, tedashis hand tile `82` (3s); South pons
  with `uses: [81, 83]` (the 3s pair).
- **JUMP anchor (scan):** a minimal prefix where a NON-adjacent seat pons — proving
  the turn jump skips seats' draws entirely. Scan seeds/prefixes in the scratchpad,
  freeze the literals.
- **RACE anchor (scan):** a minimal prefix where the same fresh discard is both
  chi-able and pon-able — the pon-over-chi determinism exhibit.

New describes, in file order after the existing illegal-actions suite:

1. **`describe('chi/pon claims fold')`** — over the anchors:
   - chi: meld `{type:'chi', claimed:100, from:0, own:[98,106]}` exposed at
     `melds[1]`, South's hand shrinks to 11 without `98`/`106`, pond `ponds[0]`
     still `[100]` (the mark: tile present + meld join), `turn === 1`,
     `mustDiscard === true`, `drawn === null`, `claimable === null`;
   - the caller's forced discard: a hand tedashi folds, `mustDiscard` clears,
     `claimable` becomes the caller's discard, `turn` advances to caller+1;
   - pon: same assertions over the PON anchor;
   - turn jump (JUMP anchor): skipped seats' hands/ponds untouched, live wall
     unmoved between discard and claim;
   - pon-over-chi (RACE anchor): the chi-logged and pon-logged records each fold
     deterministically (double-fold `toEqual`) to distinct states;
   - conservation: a local `allZonesWithMelds` flatten (zones + `melds.own`) counts
     136 unique ids across every prefix of the claim-bearing anchors;
   - claims survive `structuredClone` record-untouched (mirrors the no-mutation
     property, one example run over an anchor record).

2. **`describe('illegal claims throw')`** — through the existing `expectThrows`
   helper (works verbatim: it takes prefix + bad action + fragment), one case per
   guard: claim at hand start (no window); stale claim after the next draw; wrong
   tile; chi by a non-left seat (West chis East's discard); pon by the discarder;
   duplicate `uses`; unheld `uses` (another seat's tile; a pond tile); chi
   non-run kinds; pon non-triplet kinds; draw by the caller while `mustDiscard`;
   claim-discard of an unheld tile; chi/pon after ryuukyoku (ended-hand guard).
   Each asserts the RangeError names the action index (fragment `action ${i}`).

## Ordering (three green commits)

1. **State growth + turn-cycle amendments**: Meld/TableState/foldRecord + draw/discard
   `claimable`/`mustDiscard` mechanics + the literal updates in record.test.ts.
   Everything compiles, all existing suites green (no claim is expressible yet — the
   union members land in this commit but nothing constructs them; `applyClaim` arrives
   next). Commit gate: `just test && just check`.
2. **The claim step**: `applyClaim`, `isRun`, the chi/pon switch cases + the
   `describe('chi/pon claims fold')` suite (scratchpad scan for JUMP/RACE anchors
   happens here). Gate: `just test && just check`.
3. **The negative matrix**: `describe('illegal claims throw')`. Gate:
   `just test && just check && just build`.

Step 1 and 2 may merge into one commit if the seam feels artificial in the diff — the
plan treats them as separately verifiable regardless.
