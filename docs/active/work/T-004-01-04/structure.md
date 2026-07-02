# T-004-01-04 — call-dynamics-property-suite — Structure

## File-level changes

| File | Change |
|---|---|
| `src/core/dynamics.test.ts` | **Rewritten in place** (~280 → ~520 lines). Only file touched. |
| everything else in `src/core/` | Untouched — engine is frozen contract (design D6). |
| `src/app/` | Untouched. |

No new modules, no export changes, no shared test helpers (design D5: suites mirror,
never share). `just test`, `just check` are the verification gates.

## Internal organization of dynamics.test.ts (top to bottom)

The file keeps its five-part shape — charter comment, drivers/arbs, invariant
helpers, invariant suites, mutation suite — with each part widened. Order matters
only for reading; nothing is hoisted across sections.

### 1. Charter comment (rewritten)

Same division-of-labor statement, minus the "claims stay out" clause; now states that
the generator samples the full action vocabulary and that call density is guaranteed
by the deterministic greedy corpus, not by fc statistics.

### 2. Constants and drivers

```
seedArb                                  — unchanged, [0, 2^32)
FULL_TURNS = LIVE_WALL_SIZE - DEAL_SIZE  — unchanged (70)
MAX_MELDS = 16                           — new: 4 melds × 4 seats
ACTION_BOUND = 2*FULL_TURNS + 2*MAX_MELDS + 2   — new, with the D1 arithmetic comment
CHOICE_MAX = 19                          — new: covers the longest real offering (~18)

playRecord(seed, choices): HandRecord    — REWRITTEN (D1)
    one choice per action over the FULL offered set (drawsAndDiscards deleted);
    stops on empty offered set or exhausted choices; throws past ACTION_BOUND.

isCall(action): boolean                  — new: type ∈ {chi,pon,daiminkan,ankan,shouminkan}

playGreedy(seed): HandRecord             — new (D2)
    createRng(seed) supplies the stream (nextInt); at every point plays a call when
    one is offered (nextInt over the call slice), else nextInt over the whole set;
    same ACTION_BOUND tripwire; runs to empty offered set — always a full game.

GREEDY_CORPUS_SEEDS                      — new: a frozen integer range (0..N, N fixed
    empirically during implement so every call form appears; asserted, so a regression
    that empties a form fails loudly rather than going vacuous).

greedyCorpus: HandRecord[]               — new: module-level const, built once
    (playGreedy over the seeds); shared by the corpus suites below.
```

### 3. Arbitraries

```
gameArb       — REWRITTEN: seed + fc.array(fc.nat(CHOICE_MAX), {maxLength: ACTION_BOUND})
                + dangle boolean; map → playRecord; dangle appends the offered draw
                when the stop point is pre-draw (checks offered[0].type === 'draw').
fullGameArb   — REWRITTEN: choices at {minLength: ACTION_BOUND, maxLength: ACTION_BOUND}
                so the walk can only stop on an empty offered set (D3).
```

### 4. Invariant helpers

```
allZones(state)         — WIDENED (D4): hands, melds' own (flatMap m.own), ponds,
                          drawn, live, dead — the six-zone flatten.
expectConserved(record) — new: the every-prefix sweep (length + Set-size at each
                          prefix), extracted so the fc property and the corpus loop
                          share one statement.
countTypes(actions)     — new: tally by action type for the D3 identities.
keyOf(action)           — unchanged (already claim-aware).
assertMutantThrows(...) — unchanged (two-sided: absent from offered set, fold throws).
```

### 5. Invariant suites

```
describe('conservation over random play')
  it: six-zone partition at every prefix (property, gameArb, numRuns 50)   [D4]
  it: six-zone partition at every prefix of every greedy-corpus game       [D4]

describe('termination')
  it: every full random game ends in ryuukyoku with the end-state shape    [D3]
      (phase, live [], drawn null, mustDiscard false, claimable null,
       legalActions [], dead.length 14)
  it: draws + kans === FULL_TURNS; discards === draws + kans + chi/pons;
      ponds total === discards; melds total === chi+pon+daiminkan+ankan    [D3]
      (same fullGameArb property — one fold, both its)
  it: the greedy corpus terminates and covers every call form              [D2]
      (chi, pon, daiminkan, ankan, shouminkan all present in the corpus
       union — the -03 shouminkan generative gap closes here)

describe('fold determinism over random play')
  it: double-fold deep-equal + fresh arrays (property, gameArb — now
      claim-bearing; adds melds freshness: second.melds !== first.melds)
  it: double-fold deep-equal over the greedy corpus (call-dense region)
```

### 6. Mutation suite — describe('mutated sequences throw')

Operators in AC-family order; all reuse assertMutantThrows unless noted.

```
wrong seat
  it: seat bump — GENERALIZED to all seven action types (a rebuild-with-seat
      switch replaces the draw/discard ternary)
wrong tiles
  it: tile retarget (discards) — kept as is
  it: claim-tile retarget — NEW: chi/pon/daiminkan at index i, tile := random
      tile ≠ window tile (fc.pre keeps it ≠), spliced back
  it: uses retarget — NEW: one uses slot := random tile; fc.pre-filters
      accidental legality via the offered-set keyOf check (discard-retarget
      precedent)
stale discard
  it: stale-window shift — NEW: for a claim at index i, prefix' = actions[0..i)
      + the offered draw at that point; mutant = the claim itself
out of sequence (kept family)
  it: type flip — restricted to draw/discard indexes (fc.pre)
  it: duplicate — unchanged code; now doubles claims/kans too (throws via
      closed window / melded-away uses / turn guards)
  it: append after ryuukyoku — menu widened with claim forms over fullGameArb
dead-wall exhaustion (directed anchors, mirrored from legal.test.ts — D5)
  FOUR_KAN_SEED / FOUR_KAN_GEOMS / fourKanChain() / fifthKanWindowRecord()
      — mirrored verbatim (frozen literals, never regenerate)
  it: fifth kan at the seed-101033 window — daiminkan mutant is unoffered and
      throws 'no rinshan tile remaining'
  it: kan on the emptied wall at seed-1004 haitei — ankan of the concealed 5p
      quad (uses [55,52,53,54]) is unoffered and throws 'on an empty live wall'
```

## Ordering of changes (matters for a reviewable diff)

1. Drivers first (playRecord rewrite, ACTION_BOUND, playGreedy, corpus) with the
   charter comment — the suite compiles but old exact-count tests fail.
2. Invariant suites re-stated (conservation zones, termination identities,
   determinism) — green again.
3. Mutation operators (generalized + new) and the mirrored exhaustion anchors.
4. Empirical freeze: pick GREEDY_CORPUS_SEEDS' N, pin the coverage assertion,
   check runtime budget (~2s added max), tune numRuns dials if needed.

Steps 1–2 must land together (one commit); 3 and 4 can be separate commits.

## Interfaces consumed (all frozen, from ./index)

`foldRecord`, `legalActions`, `createRng`, `nextInt`, types `HandAction`,
`HandRecord`, `Seat`, `TableState`, constants `DEAL_SIZE`, `LIVE_WALL_SIZE`,
`SEAT_COUNT`, `TILE_COUNT`, `DEAD_WALL_SIZE`. No new engine surface is requested.
