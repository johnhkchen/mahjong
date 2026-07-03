# Design: T-009-01-04 riichi-property-suite

## Decision

Add one new MECHANICAL riichi-eager driver per file (duplicated, trimmed to what each
file needs — the established convention), each producing a small frozen corpus of
whole `HandRecord`s that actually declare riichi. Map the AC's five clauses onto the
two files as follows, reusing existing machinery wherever it already generalizes:

| AC clause | Home | Mechanism |
|---|---|---|
| 1. post-riichi discard = drawn tile | `dynamics.test.ts` | new property, corpus-driven, independently restated |
| 2. points + pot = 4×25000 | `dynamics.test.ts` | new property, corpus-driven, restates `game.ts`'s carry rule |
| 3a. offered riichi folds | `legal.test.ts` | new property, corpus-driven, reuses the existing "every offered action folds" assertion shape |
| 3b. non-offered riichi throws | `dynamics.test.ts` | new mutation operator in "mutated sequences throw," reusing `assertMutantThrows` |
| 4. re-folds deeply equal | `dynamics.test.ts` | FREE — widening `anyGameArb` extends the EXISTING determinism property |
| 5. every game terminates | `dynamics.test.ts` | non-vacuity assertion beside clause 1/2, plus the driver's own `ACTION_BOUND` throw-guard (existing pattern) |

## The driver: `playRiichiEager` (mechanical, no `policy.ts`)

```ts
function playRiichiEager(seed: number): HandRecord {
  const rng = createRng(seed)
  const actions: HandAction[] = []
  for (;;) {
    const state = foldRecord({ seed, actions })
    const legal = legalActions(state)
    if (legal.length === 0) return { seed, actions }
    const isCallPoint =
      state.phase === 'ryuukyoku' ||
      (state.drawn === null && !state.mustDiscard && state.claimable !== null)
    let chosen: HandAction
    if (isCallPoint) {
      const ron = legal.find((a) => a.type === 'ron')
      chosen = ron ?? legal[nextInt(rng, legal.length)]
    } else {
      const tsumo = legal.find((a) => a.type === 'tsumo')
      const riichi = legal.find((a) => a.type === 'riichi')
      const draw = legal.find((a) => a.type === 'draw') // plain "must draw," no window
      chosen = tsumo ?? riichi ?? draw ?? bestDiscardOf(state, legal, rng)
    }
    actions.push(chosen)
    if (actions.length > ACTION_BOUND) throw new Error(/* ... */)
  }
}
```

`bestDiscardOf` picks, among the offered `discard`-type actions for the turn seat
(1 when locked, 14 when not — no branch needed, `legal.filter` naturally narrows),
the one minimizing `shanten(remainingKinds, melds)`, rng-broken among ties via the
same `nextInt`/`createRng` stream every other driver in the file already uses. This is
arithmetic over `shanten` (already core vocabulary `legal.ts`'s own `riichiOffers`
calls directly), not a policy import — stays inside `dynamics.test.ts`'s declared
"mechanical generators only" doctrine (research.md).

Call points prefer any ron (mirrors `playWinEager`'s exact call-point rule verbatim),
else fall back to the SAME uniform-by-index rng sampling `playRecord`/`playWinEager`
already use. This means the corpus will ALSO exercise open-hand riichi-ineligibility
(a seat that called can never again satisfy `isMenzen`) essentially for free, without
a dedicated branch.

Priority order at an own-turn point — tsumo, then riichi, then the plain draw (a
claimless pre-draw point offers nothing else), then shanten-minimizing discard —
mirrors the file's own established layering (win offers precede everything else in
`legalActions`' own enumeration order; `playWinEager` already puts win-taking first).
A locked seat's own-turn point degenerates correctly with NO special case: `legal`
there is `[discard(drawn)]` or `[discard(drawn), tsumo]` (`legalActions`' own locked
branch), so `tsumo ?? riichi ?? draw ?? bestDiscardOf` always resolves to the one
legal choice, or the tsumo when offered.

## Corpus sizing and non-vacuity

`RIICHI_CORPUS_SEEDS = Array.from({ length: 30 }, (_, i) => i)` in `dynamics.test.ts`
(the `GAME_SEEDS`/contiguous-small-range precedent, sized between `GAME_SEEDS`'s 20 and
`GREEDY_CORPUS_SEEDS`'s 100 — this driver reaches tenpai far more reliably than uniform
sampling because of the shanten-minimizing fallback, so 30 is expected to be plenty;
confirmed empirically in Implement, widened if the non-vacuity assertions fail). A
SMALLER corpus (10-15 seeds) is planned for `legal.test.ts`'s own duplicate — that
file's new test walks EVERY PREFIX of every corpus record (`O(n²)` per record, the
`expectConserved` precedent), so it needs less breadth than `dynamics.test.ts`'s
whole-corpus, whole-game assertions.

Non-vacuity, per both files' existing discipline ("a zeroed tally must widen the
corpus, never weaken the check" — `game.dynamics.test.ts`'s own renchan/rotation
counts, `dynamics.test.ts`'s own call-form coverage): assert directly that (a) at
least one corpus record's actions contain a `'riichi'` entry, (b) both `'agari'` and
`'ryuukyoku'` endings occur among riichi-bearing records — proving the pot-carry
formula is exercised on both branches of `game.ts`'s `state.phase === 'agari' ? 0 :
state.pot` rule, not just one.

## Clause-by-clause test design

**1. Tsumogiri lock, restated independently.** Walk each corpus record's actions;
for every `discard`-type action at index `i`, fold the PRIOR state
(`foldRecord({ seed, actions: actions.slice(0, i) })`) and read `priorState.riichi[seat]`
/ `priorState.drawn` directly off it — these are the exact inputs the discard action
is choosing against, the same "read the prior fold's own fields as ground truth" idiom
`assertMutantThrows` already uses pervasively (computing `offered` from a prior fold to
compare a mutant against) — not a re-derivation of `record.ts`'s OWN branch logic
(there is no independent "was this seat locked" rule to restate; `riichi` IS the fact,
tracked nowhere else). When `priorState.riichi[seat]` is true, assert
`action.tile === priorState.drawn`. Refolding every prefix is `O(n²)` per record;
acceptable at this corpus size (the `expectConserved`/`dynamics.test.ts` precedent
already pays this cost per-seed for a 50-run property).

**2. Points + pot conservation.** For each corpus record's ended state:
```ts
const breakdown = scoreBreakdownOf(state)
const carriedPot = state.phase === 'agari' ? 0 : state.pot // game.ts's own carry rule, restated
expect(breakdown.scores.reduce((a, b) => a + b, 0) + carriedPot).toBe(4 * 25000)
```
This is the CORRECTED invariant `settlement.ts`'s own header names (research.md) — a
genuinely different, stronger claim than `settlement.property.test.ts`'s existing
"deltas sum to zero," which only holds when no pot ever existed.

**3a. Offered riichi folds (`legal.test.ts`).** Extend `describe('offered actions
fold', ...)` with one more property, identical shape to the existing "every action
`legalActions` returns is accepted by the step function," except walking every prefix
of the new riichi corpus instead of `prefixArb`'s tsumogiri-only prefixes:
```ts
for (let len = 0; len <= actions.length; len++) {
  const state = foldRecord({ seed, actions: actions.slice(0, len) })
  for (const action of legalActions(state)) {
    expect(() => foldRecord({ seed, actions: [...actions.slice(0, len), action] })).not.toThrow()
  }
}
```
Non-vacuous BY CONSTRUCTION: many of those prefixes are genuinely mid-riichi-window or
locked, because the corpus was built to reach exactly those states.

**3b. Non-offered riichi throws (`dynamics.test.ts`).** One more `assertMutantThrows`
operator in `'mutated sequences throw'`, the `tile retarget`/`uses retarget` shape:
take a random `discard` action from (the now-widened) `anyGameArb`, rewrite it as
`{ type: 'riichi', seat, tile }` keeping the same seat/tile, `fc.pre`-filter out the
rare case where that EXACT riichi happens to already be offered, assert absent +
thrown. Also widen the two existing "action after the end" `menu` literal arrays
(`'append after ryuukyoku'` and the win-corpus `'after a win... every action form
throws'`) with a `{ type: 'riichi', seat, tile }` entry each — a real, currently-open
gap (neither menu names `riichi` OR `tsumo`/`ron` today for the ryuukyoku-menu case),
directly serving the same AC clause for the ended-hand edge specifically.

**4. Determinism — free.** `anyGameArb = fc.oneof(gameArb, corpusGameArb,
riichiCorpusGameArb)`. The existing `'fold determinism over random play'` test already
asserts `foldRecord` twice on `anyGameArb` and deep-equals the results (plus fresh-array
identity checks) — widening the source arbitrary is the whole change; no new `it`.

**5. Termination.** Corpus construction itself converts non-termination into a thrown
error via `ACTION_BOUND` (the `playGreedy`/`playWinEager` precedent, not a new idea);
the non-vacuity assertion (clause 5's other half — "every game STILL terminates," not
just "doesn't hang") checks `state.phase` is `'agari'` or `'ryuukyoku'` for every
corpus record, alongside the riichi/both-endings checks above (one `it`, several
`expect`s, matching `greedyCorpus`'s own combined termination+coverage test shape).

## Alternatives considered

**A. Use `discardPolicy`/`callPolicy` (real bots) for the `dynamics.test.ts` driver,
matching `game.dynamics.test.ts`/`settlement.property.test.ts`.** Rejected:
`dynamics.test.ts`'s own header explicitly declares bots out of scope for its
generators ("a later epic with their own shape") — a real, stated design boundary for
THIS file, not an oversight. The shanten-minimizing mechanical fallback reaches tenpai
reliably enough without crossing it (confirmed in Implement).

**B. One combined driver + corpus, imported into both files.** Rejected: no shared
test-utils module exists anywhere in `src/core/` (research.md) — every existing
cross-file driver (`keyOf`, `tsumogiriRecord`/`dealtLive`/`dealtDead`, the `selfPlay`
family) is duplicated per file, trimmed to that file's own needs. `legal.test.ts`'s
copy only needs to WALK a corpus (no mutation, no scoring); `dynamics.test.ts`'s needs
the full driver plus `bestDiscardOf` plus the widened `anyGameArb`. Following the
convention keeps each file self-contained and matches how a future engine change
(e.g. a new call form) would only ever require one file's driver to change if it
doesn't affect the other's assertions.

**C. Put the points+pot conservation property in `settlement.property.test.ts` instead
(it already has a conservation section).** Rejected: the ticket text explicitly scopes
this to "the existing dynamics/agreement suites... rather than forking them" — reading
that as the two named files, not a third. `settlement.property.test.ts`'s own §D stays
stale (flagged, not fixed) per research.md's scope call; a future ticket can retire or
correct it without this one needing to touch a third file.

**D. Assert clause 1 (tsumogiri lock) by trusting corpus construction alone (no
explicit property).** Rejected: the fold's own throw-on-violation guard means a corpus
built exclusively from `legalActions` can never demonstrate a violation either way —
"it didn't throw while being built" is not the same claim as "every locked-seat
discard equals the drawn tile," and the codebase's own doctrine (game.dynamics.test.ts's
`nextExpectedDealer`, dynamics.test.ts's whole mutation-throw section) is to state
facts about a fold's OUTPUT independently rather than infer them from "construction
didn't throw."

**E. Mine and freeze a specific seed list (the `WIN_CARRIER_SEEDS` precedent) instead
of a contiguous range.** Deferred, not rejected: start with a contiguous `[0, 30)`
range (`GAME_SEEDS`'s own precedent) since the shanten-minimizing driver is expected to
reach tenpai often; only fall back to a mined, frozen, non-contiguous list (documented
inline exactly like `WIN_CARRIER_SEEDS`'s own comment) if empirical non-vacuity
assertions fail against the contiguous range during Implement.
