# T-004-01-01 — chi-pon-claim-fold-semantics — Plan

Ordered, independently verifiable steps. Gates use the pinned toolchain:
`just test` (vitest over src/core/), `just check` (svelte-check + tsc),
`just build` at the end. Commits follow the house message style
(`T-004-01-01: <what the step did>`).

## Step 0 — Baseline

Run `just test && just check` on the untouched tree so any later failure is
attributable to this ticket. No commit.

## Step 1 — Grow the state: Meld, TableState fields, turn-cycle plumbing

**Edit `src/core/record.ts`:**
1. Import `rankOf`, `suitOf` (and `TileKind` if not already in scope) from `./tiles`.
2. Add the two `HandAction` members (`chi`, `pon`) and extend the vocabulary doc block
   with the claim conventions (claimed tile + `uses` as deliberate redundancy; `uses`
   are physical ids in recorded order).
3. Add `export interface Meld` between `HandRecord` and `TableState`.
4. Add `melds`, `claimable`, `mustDiscard` to `TableState`; widen the conservation
   doc to name the melds-own zone.
5. `case 'draw'`: guard `mustDiscard` (throw "draw out of sequence — seat S owes a
   discard for its claim") after the seat check; set `claimable = null` on success.
6. `case 'discard'`: add the `mustDiscard` arm (hand-only discard, its own not-held
   message, clears the flag); set `claimable = {seat, tile}` at the end of every
   discard that leaves the hand `playing`.
7. `foldRecord`: initialize `melds: [[], [], [], []]`, `claimable: null`,
   `mustDiscard: false`.
8. Add unreachable-safe switch cases `'chi'`/`'pon'` that delegate to a stub
   `applyClaim`? **No** — leave the cases OUT of this step; the union members exist
   but fold via the `default` arm ("unknown action type") until Step 2 lands.
   Rationale: no half-implemented claim can fold silently, and TS is satisfied
   because the default arm accepts the widened union.

   *Deviation risk:* the `default` arm's `never`-typed exhaustiveness comment — the
   cast there already tolerates non-never types, but if tsc complains, fold Step 2's
   case labels in early with a `throw` body and note the deviation in progress.md.

**Edit `src/core/record.test.ts`:** add the three new fields to the empty-log
full-TableState literal (`melds: [[], [], [], []], claimable: null,
mustDiscard: false`).

**Verify:** `just test && just check` — every existing test green. Specifically watch:
- the deep-equal fold tests (new fields compare equal between folds);
- the `'riichi'` unknown-type test (still lands in `default`);
- svelte-check over the app (additive fields, no consumer breaks).

**Commit:** `T-004-01-01: claim-window state — melds, claimable, mustDiscard in the fold`

## Step 2 — The claim step: applyClaim + isRun + chi/pon cases

**Edit `src/core/record.ts`:**
1. `isRun(a, b, c)` — same numbered suit, ranks a permutation of {r, r+1, r+2}.
2. `applyClaim(state, action, index)` with the frozen guard order (structure.md §5):
   window → seat (chi: left-neighbor; pon: not-discarder) → tile → uses-distinct →
   uses-held (both, before any splice) → shape. Success mutations: splice both `uses`,
   push the meld, `turn = seat`, `claimable = null`, `mustDiscard = true`.
3. Switch cases `'chi'`/`'pon'` delegating to `applyClaim`.

**Scratchpad scan** (throwaway script under the session scratchpad, run with
`flox activate -- npx tsx` or via a temporary vitest file — NOT committed): walk small
seeds folding short legal prefixes to locate and freeze:
- JUMP anchor: minimal (seed, prefix) where a non-adjacent seat can pon;
- RACE anchor: minimal (seed, prefix) where one fresh discard is chi-able AND pon-able.
Record the derivation (seed, tile ids, kinds) into test comments; cross-check the
frozen literals by hand (kind arithmetic: `kind = TILE_KINDS[floor(id/4)]`).

**Edit `src/core/record.test.ts`:** new `describe('chi/pon claims fold')` per
structure.md — chi anchor, pon anchor, caller's forced discard, JUMP, RACE
(double-fold determinism, distinct outcomes), conservation-with-melds over every
prefix of the anchors, record-not-mutated example.

**Verify:** `just test && just check`. The chi/pon anchors' expectations are
wall-derived/hand-derived literals — if a literal disagrees with the fold, the FOLD is
suspect first (house rule: expectations never come from the code under test).

**Commit:** `T-004-01-01: chi/pon claims fold — meld exposure, turn jump, forced discard`

## Step 3 — The negative matrix

**Edit `src/core/record.test.ts`:** new `describe('illegal claims throw')` via the
existing `expectThrows` helper — the 13 cases from structure.md (window/stale, wrong
seat both forms, wrong tile, discarder pon, duplicate/unheld uses, non-run chi,
non-triplet pon, draw-while-owing, claim-discard unheld, claims after ryuukyoku), each
also asserting the error names the acting index (`action N`).

**Verify:** `just test && just check && just build` (the build gate proves the single
file still compiles end to end).

**Commit:** `T-004-01-01: illegal-claim matrix — every claim guard throws by index`

## Step 4 — Acceptance sweep + artifacts

- Re-read the AC line by line against the landed tests (chi left-neighbor-only ✓ pon
  any-seat ✓ meld exposed ✓ pond mark ✓ turn jump + forced discard ✓ pon-over-chi
  determinism ✓ wrong-tile/wrong-seat/stale throws naming the index ✓).
- Confirm untouched files really are untouched (`git diff --stat` shows only
  record.ts, record.test.ts and docs/).
- Write progress.md (running during Steps 1–3) and review.md.
- No `/verify` app drive: claims are unreachable from the running app until
  T-004-01-03 offers them through `legalActions` — the fold's new paths have no
  runtime surface beyond the tests that exercise them directly. Note this in
  review.md.

## Testing strategy summary

| Layer | What | Where |
|---|---|---|
| Example (wall-derived) | chi/pon anchors, meld shape, pond mark, turn jump, forced discard | record.test.ts, Step 2 |
| Example (frozen scan) | JUMP + RACE anchors, pon-over-chi determinism | record.test.ts, Step 2 |
| Invariant | 136-id conservation incl. melds.own over all anchor prefixes; double-fold equality; record immutability | record.test.ts, Step 2 |
| Negative | 13-case illegal-claim matrix, RangeError + index | record.test.ts, Step 3 |
| Regression | full existing suites (record/legal/dynamics/purity/app) at every gate | Steps 1–3 |

Out of scope, owned downstream: legalActions claim offers + agreement (T-004-01-03),
claim-sampling dynamics properties (T-004-01-04), kan/rinshan/kandora (T-004-01-02),
app drive + UI (T-004-02-01/02).

## Risks & watchpoints

- **The default-arm typing wrinkle** (Step 1) — resolved by the noted fallback;
  either way no claim folds before Step 2.
- **Scan comes up empty at tiny seeds** for JUMP/RACE — widen the scan over seeds
  0..999 and prefix lengths up to ~8 turns; both patterns are common (any pair in an
  off-turn hand + any matching discard), so this is a cost bound, not a feasibility
  risk.
- **`claimable` on the pre-claim discard vs. `toEqual` folds** — same-record folds
  compare identical values; only the empty-log literal is asserted exhaustively, and
  it is updated in Step 1.
- **Turn-jump interaction with `turn` advancing on discard** — after a discard `turn`
  already points at the rotation seat; a claim OVERWRITES it with the caller. Tests
  must cover the case where these coincide (South claims East's discard — chi always
  does) and where they don't (JUMP anchor).
