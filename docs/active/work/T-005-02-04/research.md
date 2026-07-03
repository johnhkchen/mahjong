# T-005-02-04 — win-conservation-determinism-suite — Research

Descriptive map of what exists. The ticket: the dynamics/property suite green over
random seeded hands driven by index-sampled `legalActions` where a nonzero share end
in tsumo or ron — the 136-tile conservation partition holds through the ended state,
replaying any log reproduces the same winner/tile/yaku, and `legalActions` is empty
after every win. Dependency T-005-02-02 (win offers + furiten gate) is done: wins
are already IN the offered set that index-sampling drivers consume.

## 1. The suite this ticket extends

`src/core/dynamics.test.ts` (690 lines) is the turn-loop property suite: dynamics
over RANDOM-LEGAL trajectories, where a generator picks every move from
`legalActions` and state only ever advances by refolding the longer record —
`foldRecord` stays the single authority, no step logic reimplemented. Its declared
doctrine (header, lines 1–14): properties assert only self-evident invariants
(conservation, double-fold determinism, structural termination, throw-on-mutation),
never derived values; and coverage facts are PINNED, never fc statistics ("call
density is a pinned fact, never an fc statistic").

Machinery already present, all test-local:

- `playRecord(seed, choices)` (line 90) — the index-sampling walk: forced points
  auto-play, each multi-offer decision consumes one choice by `choices[c] % legal.length`.
  Stops when choices run out or the offered set empties. Hard `ACTION_BOUND` = 172+2.
- `playGreedy(seed)` (line 123) — deterministic call-greedy driver using core's own
  `createRng`/`nextInt` (reproducible arithmetic, not fc sampling). It FILTERS OUT
  win offers up front, by design: an eager win would truncate games and starve call
  coverage. "Wins in random trajectories are playRecord's business."
- `greedyCorpus` — seeds 0..99, range frozen empirically (ankan carriers 63/67/69),
  with an asserted every-call-form coverage test so vacuity fails loudly.
- `allZones`/`expectConserved` (lines 162–182) — the six-zone flatten (hands, melds'
  `own`, ponds, drawn, live, dead) checked for 136 distinct ids at EVERY log prefix.
- `countTypes`/`expectEndIdentities` (lines 185–223) — exact end-of-game equalities;
  already win-aware: a tsumo leaves one discard obligation unmet (`state.win?.by
  === 'tsumo'` → `unmet = 1`), an agari may end mid-wall (`FULL_TURNS − live.length`).
- `gameArb`/`fullGameArb` (lines 230–259) — fc arbitraries over `playRecord`.
  `fullGameArb` supplies ACTION_BOUND choices so the walk stops only when the
  offered set empties: the termination test (line 283) already branches on
  `phase === 'agari'` vs `'ryuukyoku'`, asserts the closed end shape (tsumo keeps
  `drawn === win.tile`; ron's tile is the discarder's pond tail; `turn === winner`),
  asserts `legalActions(state)` empty, and runs the end identities.
- The mutation operators (line 417 on) already span the win forms: `withSeat`
  handles tsumo/ron, `duplicate` covers a doubled win, `append after ryuukyoku`
  covers seven non-win forms appended to a FULL game (which may have ended in agari).
- `keyOf` (line 357) — offered-set membership key, uses sorted.

## 2. What the engine guarantees at a win (fold side)

`src/core/record.ts`:

- `TableState.win` (lines 256–271): `{by, winner, tile, yaku}` (+`from` for ron).
  `yaku` is `yakuOf`'s list verbatim — "deterministic order, the aggregator's
  contract, so replaying a log reproduces the identical win by construction."
- The winning tile never changes zone (lines 250–255): a tsumo's tile stays in
  `drawn`, a ron's stays counted in the discarder's pond — "the 136-tile
  conservation partition is untouched by winning." Conservation through the ended
  state is therefore expected to hold with the EXISTING `allZones`, unchanged.
- `applyAction` (line 781): after any ended phase every action throws — with ONE
  carve-out, ron out of 'ryuukyoku' (houtei). After 'agari' even a ron throws.
- `applyWinTail` (line 629): derives yaku at fold time; throws on non-completion
  and on yakuless completion (one-yaku gate). Nothing about the win is recorded in
  the log — winner/tile/yaku are all re-derived on every fold, which is exactly
  what makes "replay reproduces the same win" a real property, not a tautology.

`src/core/legal.ts`:

- `legalActions` on `phase === 'agari'` returns `[]` unconditionally (line 291).
- On `'ryuukyoku'` it returns ONLY the houtei ron offers (line 292–295) — so a
  ryuukyoku end may offer a win; an eager driver that takes offered wins can never
  strand a non-empty offered set at game end.
- Win offers are gated (completion, furiten for ron, one-yaku); the FURITEN
  DIVERGENCE means offered ⊂ folds for ron. An index-sampling driver only ever
  plays offered actions, so driven games stay inside the agreement region.

## 3. What already covers parts of the AC, and the gaps

| AC clause | Existing coverage | Gap |
|---|---|---|
| nonzero share of driven games end in tsumo/ron | none — `fullGameArb`'s agari branch exists but nothing asserts it is ever taken; `playGreedy` filters wins out | the vacuity risk: if win offers regressed to never-offered, every agari assertion in the suite would silently stop running |
| conservation through the ended state | `expectConserved` over `gameArb` prefixes (50 fc runs) — wins reachable but not guaranteed sampled | no pinned win-ending game is conservation-checked |
| replay reproduces winner/tile/yaku | double-fold `toEqual` over `anyGameArb` (whole state, so `win` included) — but corpus games are all ryuukyoku, and fc games rarely reach wins | no assertion names the win triple on a game known to end in a win |
| legalActions empty after every win | asserted in the fullGameArb termination property's agari branch (rarely taken) and on -02's constructed anchors (legal.win.test.ts line 316) | no coverage over DRIVEN wins; no fold-side "nothing folds after agari, not even ron" over driven wins |

## 4. Empirical grounding (scratchpad scan, this ticket)

Drivers bundled against `src/core` via esbuild and run over contiguous seed ranges
(`scan-win-share.ts` / `scan2.ts` in the session scratchpad):

- Uniform index-sampling (playRecord-style, core rng picks the index, wins in the
  pool like any offer): seeds 0..999 → **3 wins** (ron 626, 731, 834; no tsumo).
- Win-eager index-sampling (take a win offer whenever one is present, else uniform
  over the full offered set): seeds 0..999 → **8 wins** — tsumo [876, 950],
  ron [100, 277, 360, 626, 731, 834]; 992 ryuukyoku.
- Tsumogiri-eager (no claims, always discard the draw, take wins): seeds 0..299 →
  **0 wins**. Static 13-tile hands almost never meet a yaku-bearing wait; the -02
  fixture mining had to scan thousands of seeds per anchor. Random claim churn is
  what creates win opportunities.
- Cost: ~3.5 ms per driven game (per-action refolds included) — 400 games ≈ 1.4 s,
  1000 games ≈ 3.5 s, at module load if the corpus is module-level like greedyCorpus.

So: wins under honest index-sampling are REAL but rare (~1%/hand win-eager). Any
"nonzero share" statement needs either a wide frozen range or mined carriers; both
precedents exist in-repo (greedy corpus = frozen contiguous range with coverage
assertion; four-kan/haitei anchors = frozen mined seeds, "never regenerate").

## 5. Constraints and conventions to respect

- Pinned-not-statistical: the nonzero-share fact must be a deterministic corpus
  assertion, not an fc run counter (suite doctrine, header lines 10–12).
- Drivers use core's own rng (`createRng`/`nextInt`) for reproducible arithmetic;
  fc arbitraries are for sampling trajectory SPACE, not for corpus facts.
- `foldRecord` is the only state-advancer; no incremental step logic in tests.
- Purity gate (`purity.test.ts`): runtime core modules import only siblings — test
  files are unaffected, but nothing engine-side should change for this ticket at
  all: research found no engine gap; the AC is satisfiable purely in test code.
- Suites import from `./index` (the barrel-export check) — dynamics.test.ts does.
- `just test` = vitest over src; suite runtime budget matters (module-load corpora
  run on every test invocation; greedyCorpus already costs ~0.4 s).
- Comment style: heavily narrated tests, each constant naming its seed/geometry and
  why it is frozen ("never regenerate").

## 6. Relevant files

- `src/core/dynamics.test.ts` — the suite to extend (all helpers test-local).
- `src/core/record.ts` — fold; win tail; ended-phase guard (read-only here).
- `src/core/legal.ts` — offered set incl. win offers (read-only here).
- `src/core/legal.win.test.ts` — -02's agreement suite; constructed win anchors
  already assert agari-offers-nothing at fixed points; no driven-trajectory cover.
- `src/core/index.ts` — barrel; everything needed is already exported.
- `docs/active/work/T-005-02-02/` — precedent artifacts (mining conventions).
