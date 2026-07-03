# Research — T-009-02-02 riichi-dynamics-suite

## Ticket

Close the loop at game level: seeded multi-hand AI-vs-AI games where bots declare riichi
and fold deterministically end to end, with the stick pot conserved across hands and
ryuukyoku carries — the scored-and-staked extension of the E-008 dynamics suite.

AC: byte-identical replays; points + pot conserved at every boundary including pot
carries; riichi declarations occur in the sample (non-zero incidence, not vacuous); no
stalls.

## What already exists

### `src/core/game.ts` — the multi-hand fold

`GameRecord` (seed + one action log per hand) folds to `GameState` via `foldGame`.
`GameState` already carries a `pot` field (`table!.pot`, i.e. the active hand's current
`TableState.pot`) alongside `scores`/`dealer`/`seatWinds` — added for exactly this
purpose per its doc comment: "T-009-01-01... exposed here for symmetry... 0 unless some
hand in this game has ever carried a riichi." `foldGame`'s per-hand loop threads
`potIn`/`pot` hand to hand: `pot = state.phase === 'agari' ? 0 : state.pot` — reset to 0
when a hand ends in agari (winner takes the whole pot in their settlement delta), carried
forward untouched on ryuukyoku (unclaimed, sits in `state.pot`). This carry rule is
restated independently by test in `game.dynamics.test.ts` (`nextExpectedDealer` for
dealer, no pot equivalent yet — see below) and in `dynamics.test.ts`'s single-hand
`carriedPot` computation.

### `src/core/record.ts` / `settlement.ts` — the underlying invariant

`RIICHI_STICK = 1000` (record.ts:130). A riichi declaration (`applyRiichi`) moves
`RIICHI_STICK` into `state.pot` — **denominated in points already**, not a stick count;
no ×1000 conversion is needed anywhere pot is combined with scores. `settlement.ts`'s own
module header states the corrected conservation law explicitly (lines 53-66): every
riichi-locked seat already gave up `RIICHI_STICK` the instant it declared
(`riichiStickDeltas`, -1000 per locked seat); an agari's deltas sum to the incoming
`potIn` (this hand's own new sticks cancel against the pot the winner takes, leaving only
what was already carried in); a ryuukyoku's deltas sum to `-RIICHI_STICK ×` sticks placed
this hand (money that left scores and now sits unclaimed in `state.pot`). **The invariant
is `scores.reduce(+) + carriedPot === 4 × STARTING_SCORE`, where `carriedPot` is 0 after
an agari and `state.pot` after a ryuukyoku** — not `scores.reduce(+) === 4 × 25000` alone.

### `src/core/policy.ts` — bots already declare riichi

T-009-02-01 (status: done) wired `discardPolicy` to declare riichi whenever a matching
offer exists for its chosen discard tile (policy.ts:167-181), deterministically, no
independent scan. This means any existing self-play driver that already calls
`discardPolicy` for own-turn choices **now produces riichi declarations without any
change to the driver itself** — confirmed by an ad hoc probe (20 seeds × 6 hands = 120
hands, the exact corpus `game.dynamics.test.ts` already builds): 83/120 hands contained a
riichi declaration. Incidence is not a concern.

### `src/core/game.dynamics.test.ts` — the E-008 suite this ticket extends

This file **already is** the seeded multi-hand AI-vs-AI game suite named in the ticket
(header: "generalizing T-008-02-01... via a fast-check property"). It already:
- drives `selfPlayHand` with `discardPolicy`/`callPolicy` exactly as production bots
  would (own-turn discard, claim-window arbitration, riichi included via discardPolicy
  automatically — see above),
- chains `HANDS_PER_GAME = 6` hands per game over `GAME_SEEDS` (20 fixed seeds) and an
  `fc.property` over the full `uint32` seed domain (8 runs),
- asserts byte-identical replay (`multi-hand dynamics: byte-identical replay` describe
  block) — this AC clause is **already fully satisfied**, no change needed there,
- asserts dealer/seat-wind bookkeeping at every hand boundary, independently restated
  (`nextExpectedDealer`/`expectedSeatWinds`, never reading `foldGame`'s own branch),
- asserts non-stalling (every hand ends `'agari'` or `'ryuukyoku'`, action count capped at
  `ACTION_BOUND`, corpus non-vacuously exhibits both endings) — **already satisfied**.

**What it does NOT yet do, and currently gets wrong:** `expectValidBoundary`
(game.dynamics.test.ts:206) asserts `state.scores.reduce((a,b)=>a+b,0) === 4 *
STARTING_SCORE` — the PRE-riichi conservation law, not the pot-aware one. Running
`npx vitest run src/core/game.dynamics.test.ts` today (before this ticket's changes)
**fails two of its three tests** with `expected 99000 to be 100000` — a live regression:
T-009-02-01 made bots declare riichi, which now legitimately parks 1000 points in
`state.pot` at hand boundaries, and this suite's own conservation check never accounted
for it. This is the exact gap the ticket closes; it is not hypothetical.

There is also no dedicated assertion that riichi actually occurs in the corpus (AC:
"asserts non-zero incidence"), and no assertion isolating the pot-carry rule itself
(distinct from the aggregate conservation sum) — both present in `dynamics.test.ts`'s
single-hand riichi suite (T-009-01-04) but not yet restated at the game level.

### `src/core/dynamics.test.ts` — the single-hand precedent to mirror

The `describe('riichi over random play (T-009-01-04)')` block (lines 830-895) is the
single-hand analogue of everything this ticket needs at game level:
- non-vacuity tally: counts hands whose action log contains a `'riichi'` action, asserts
  `> 0`, and asserts both `'agari'` and `'ryuukyoku'` endings appear in that riichi-bearing
  subset,
- the pot-aware conservation check, computed per record: `carriedPot = phase === 'agari'
  ? 0 : state.pot`; `expect(breakdown.scores.reduce(+) + carriedPot).toBe(4 * 25_000)`.

Both patterns translate directly to the game-level corpus loop already in
`game.dynamics.test.ts`, which iterates hand-ended `TableState`s (`endedState`) at every
prefix boundary already.

## Constraints / non-goals

- `STARTING_SCORE` (25000) is already a module-private restatement in
  `game.dynamics.test.ts`; reuse it, do not import game.ts's private copy.
- No change to `game.ts`, `record.ts`, or `settlement.ts` — the pot mechanism is correct
  and already tested at the single-hand level (T-009-01-01/02/03/04); this ticket is
  purely a game-level test-suite gap, confirmed by the failing run above.
- `GAME_SEEDS`/`HANDS_PER_GAME` already produce non-vacuous riichi incidence (83/120
  hands); no corpus widening is needed.
- This codebase's stated doctrine (dynamics.test.ts, game.dynamics.test.ts headers):
  restate invariants independently by test rather than reading the implementation's own
  branch, and extend existing dynamics/agreement suites rather than forking new files.

## Repair (2026-07-04) — expanded scope, `just test` RED

The prior pass above landed `game.dynamics.test.ts` (commit `751ed5c`) but left `just
test` failing in four unrelated tests, all downstream of the same T-009-02-01 change
(bots now declare riichi eagerly) but scoped OUT of the original design.md as "other
tickets' concern." The overseer's repair note (ticket file, 2026-07-04) folds them into
this ticket instead. Mapped against `npx vitest run` before this repair:

1. **`src/core/settlement.property.test.ts`** — `"every random seed folds to an ended
   TableState whose four deltas sum to zero"` (line ~460) fails deterministically
   (`expected -1000 to be 0`, seed 415660548 shrunk from fast-check). This is the
   single-hand analogue of the exact law `settlement.ts`'s own header already documents
   (lines 53-66, read during the original research pass): once a riichi stick sits
   unclaimed in `state.pot` at a ryuukyoku ending, deltas no longer sum to zero — they sum
   to `-state.pot` (a ryuukyoku distributes nothing further; the sticks left seats' scores
   and haven't reached anyone). `endedStateOf` (this file, no `RiichiContext` — defaults
   to `potIn: 0`) means the general law (`deltas.reduce + unclaimedPot === potIn`)
   simplifies to `deltas.reduce + unclaimedPot === 0` here, where `unclaimedPot` is 0 for
   an agari (winner absorbed the whole pot into their delta) and `state.pot` for a
   ryuukyoku.

2. **`src/core/selfplay.test.ts`** — two "mined anchor" tests (`describe('mined anchors —
   the composed behavior frozen for named seeds')`) pin exact action-log lengths and win
   facts for named seeds. `selfPlay` (this file's own local driver, lines 81-139) calls
   `discardPolicy` for every own-turn choice — the same function T-009-02-01 changed — so
   its output for any seed touching a riichi-eligible turn shifted. Seed 25: same length
   (36) and same tsumo/winner/tile, `yaku` gained `'riichi'`. Seed 13: **materially
   different** — length dropped 141→107, winner shifted from seat 0 to seat 1, and the
   win is no longer a houtei ron (the hand now ends via a plain ron well before the wall
   empties). Confirmed by instrumented re-run (temporary `console.log` of `selfPlay(13)`,
   removed before commit).

3. **`src/app/drive.test.ts`** — `'plays deal → a BOT rons the player'` pins `won.win` for
   `HOUTEI_SEED` (1038928) via the app-level `playToWin` driver (a different code path
   than `selfplay.test.ts`'s local `selfPlay`, but calling the same `discardPolicy`).
   Confirmed by instrumented re-run: length (73) and every win field unchanged except
   `yaku`, which gains `'riichi'` (West is now in riichi at the moment of the win).

4. **`src/app/app.controls.svelte.test.ts`** — the repair note's fourth item ("resets
   scores to 25000 each... check newGame()/foldGame boot state") does **not** currently
   fail (`npx vitest run src/app/app.controls.svelte.test.ts`: 3/3 passing). Already fixed
   by an intervening commit (`59b81ec`, "Repair stuck loop..." per `git log`) before this
   session started. No action needed; verified, not assumed.

No production code (`policy.ts`, `settlement.ts`, `record.ts`, `game.ts`) needed to
change for any of the four — every failure is a stale test-side expectation or a stale
invariant statement, consistent with T-009-02-01 (which changed `discardPolicy`, not any
settlement/pot code) being the actual root cause of all four.
