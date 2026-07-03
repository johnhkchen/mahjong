# T-005-02-04 — win-conservation-determinism-suite — Structure

## Files

| File | Change |
|---|---|
| `src/core/dynamics.test.ts` | MODIFIED — the only code change. One driver, one frozen carrier corpus, one describe block, one header touch-up. |
| scratchpad `scan2.ts` (session-local) | Mining tool only; never committed. |

No engine files change. No new exports from `src/core/index.ts`. No new test file:
every helper the new block consumes (`expectConserved`, `expectEndIdentities`,
`isWin`, `keyOf`, `assertMutantThrows`, `ACTION_BOUND`) is test-local to
dynamics.test.ts by design.

## Internal organization of dynamics.test.ts (insertion points)

The file's existing order: header → constants → `isCall`/`isWin` → `playRecord` →
`playGreedy` → `greedyCorpus` → zone/identity helpers → fc arbitraries → describes
(conservation, termination, determinism) → `keyOf`/`assertMutantThrows`/mutation
helpers → mutations describe → dead-wall anchor section.

Four insertions, in file order:

### 1. Header comment (lines 1–14) — touch-up

"Two trajectory sources" becomes three: fc arbitraries, the greedy-call corpus,
and the win-eager carrier corpus — one sentence naming why it exists (win ends are
a pinned fact, not an fc statistic — the greedy corpus's own doctrine applied to
agari).

### 2. `playWinEager(seed)` — after `playGreedy` (~line 141)

playGreedy's mirror image, documented as such:

```ts
function playWinEager(seed: number): HandRecord
```

- Same skeleton: refold per action via `foldRecord`; `createRng(seed)` + `nextInt`
  choose by index; `ACTION_BOUND` trips on non-termination.
- Filter INVERTED: `const wins = legal.filter(isWin); const pool = wins.length > 0
  ? wins : legal` — take a win whenever one is offered (rng picks among
  simultaneous rons — a legal recorder's choice under the multiple-ron
  convention), otherwise sample the FULL offered set uniformly.
- Doc comment states the termination argument (a houtei-offering ryuukyoku gets
  its ron taken; every end leaves the offered set empty) and the division of
  labor: playGreedy filters wins OUT for call coverage, this driver hunts them.

### 3. `WIN_CARRIER_SEEDS` + `winCorpus` — after `greedyCorpus` (~line 152)

```ts
const WIN_CARRIER_SEEDS: readonly number[] = [100, 277, 360, 626, 731, 834, 876, 950]
const winCorpus: readonly HandRecord[] = WIN_CARRIER_SEEDS.map((s) => playWinEager(s))
```

- Doc comment is the freeze: mined by this ticket's scratchpad scan of the
  contiguous seed range 0..999 under this exact driver (8 carriers ≈ the share of
  random-legal games that reach a win at all); 876 and 950 end in tsumo, the rest
  in window rons; NEVER REGENERATE — a carrier stranded in ryuukyoku by a
  trajectory-shifting change is the coverage test failing as designed, and
  re-mining is a scratchpad scan away.
- Exact list pending Implement's confirmation run with the final driver code (the
  mining protocol in design.md); the seeds above are the research scan's output
  and are expected to hold since the driver is byte-for-byte the scan's policy.

### 4. `describe('wins over random play')` — after the mutations describe (~line 575)

Placed after `keyOf`/`assertMutantThrows` (it consumes both), before the dead-wall
anchor section. Four `it`s, all plain loops over `winCorpus` (corpus facts are
deterministic loops, never fc — the greedy-corpus test shape):

1. `it('every carrier game ends in agari, the corpus reaches both tsumo and ron
   ends, and the end identities hold')` — per game: `phase === 'agari'`,
   `win !== null`, `expectEndIdentities(record, state)`; across games: the set of
   `win.by` values equals/contains both `'tsumo'` and `'ron'`, with a per-form
   failure message naming the missing form (the greedy coverage-test idiom).
2. `it('the 136-tile partition holds at every prefix of every won game, through
   the ended state')` — `expectConserved(record)` per game (the final prefix IS
   the won state; the winning tile keeps its zone).
3. `it('refolding a won record reproduces the identical winner, tile, and yaku
   (property of the fold, exhibited on driven wins)')` — fold each record twice:
   `second.win` non-null and deeply equal to `first.win` (winner/tile/yaku — the
   yaku list in the aggregator's deterministic order), and `second` toEqual
   `first` as whole states.
4. `it('after a win nothing is offered and every action form throws — ron
   included')` — per game: `legalActions(foldRecord(record))` is `[]`; then a
   9-form menu (the append-after-ryuukyoku menu widened by `tsumo` and `ron`)
   through `assertMutantThrows(seed, record.actions, form, [])` for each seat —
   pinning that the ryuukyoku→ron carve-out is houtei-only and that a second ron
   after a win throws (the multiple-ron convention's rejection).

## Boundaries and invariants preserved

- `foldRecord` remains the only state-advancer; the driver never steps state
  incrementally.
- The suite's pinned-not-statistical doctrine: all new facts are corpus loops.
- Extend-only: no existing test, helper, constant, or assertion changes shape;
  the only edit to existing text is the header's source count.
- Module-load budget: +8 driven games ≈ 30 ms next to greedyCorpus's ~400 ms.

## Ordering of changes

1. Confirm carriers with the final driver code (scratchpad run; adjust the list
   if the confirmation run disagrees with the research scan).
2. Insertions 2 + 3 + describe-block test 1 — the corpus and its anti-vacuity
   assertion (commit 1: the suite now fails loudly if wins stop happening).
3. Describe-block tests 2–4 + header touch-up (commit 2: the AC's conservation /
   replay / quiescence clauses on the pinned trajectories).
4. Full `just test` + `just check` green.
