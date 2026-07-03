# T-006-01-02 fair-play-property-tests — Review

## What changed

| File | Change |
|---|---|
| `src/core/seatview.fairplay.test.ts` | Created — 9 tests, ~470 lines. The entire ticket. |
| `docs/active/work/T-006-01-02/*` | RDSPI artifacts (research/design/structure/plan/progress/review). |

**No runtime code was touched.** Four commits, all test-only: `c452d2a` (scaffold +
surgery + guards), `75bae1d` (equivalence property), `fdba0df` (inclusion property),
`7622939` (perf: one expect per state in the inclusion sweep).

## How the AC is met

**AC clause 1 — "two TableStates that differ only in hidden tiles fold to identical
SeatViews for a given seat":** implemented as surgical hidden-pool permutation. A
folded state is deep-copied and the observing seat's hidden pool (three other
concealed hands, an undisclosed drawn tile, the whole live wall, the unflipped dead
wall) is permuted as one bag, slot-for-slot — so hidden tiles move BETWEEN zones
(an opponent's hand tile becomes a wall tile), the strongest reading of "differ only
in hidden tiles". Two mutants per state: rotate-by-1 (deterministically changes
every hidden slot — non-vacuity is structural, not statistical) and a seeded
Fisher–Yates shuffle through core's own rng. Assertion is whole-object
`toEqual` between the two projections, which doubles as the standing re-audit gate
seatview.ts:13 promises: any future SeatView widening is dragged into the property
automatically.

**AC clause 2 — "no tile id outside the public zones ever appears in a
projection":** `exposedTileIds(view) ⊆ publicIds(state, seat)`, where `publicIds`
is computed from the state independently of the projection (own hand, own drawn iff
holding the turn, all ponds, all melds' own+claimed, flipped indicators, plus the
claimable/win marks).

**"Over seeded hands":** three state sources — fc breadth (seed × turns ×
dangling-draw × seat × permutation seed over tsumogiri folds), a call-dense greedy
corpus (seeds 0/1/2/63/67/69 — 63/67/69 are dynamics.test.ts's pinned ankan
carriers; all five call forms asserted present), and the eight pinned win carriers
(tsumo and ron agari ends asserted present). Corpus sweeps run at **every prefix ×
every seat** — claim windows, mustDiscard, jumped turns, kan-dora flips,
rinshan-shortened walls, and agari states all pass through both properties.

## Test coverage

- 9 tests in the new suite: 4 surgery guards (corpus coverage, 136-id conservation
  in mutants, public-part-untouched, rotation vacuity kill), 2 equivalence
  (fc + corpus), 3 inclusion (fc + corpus + agari-final pin).
- **Teeth verified empirically** (not committed): temporarily making seatView
  expose `drawn` unconditionally failed the equivalence property after 4 fc runs
  and failed the corpus sweep — the property detects a real hidden-state leak.
- Full suite: 20 files / 475 tests green (`just test`); `just check` clean. New
  file runs in ~1.0s — inside the informal budget with no coverage sacrificed.

## Judgment calls a reviewer should check

1. **Tsumo discloses the drawn tile** (the one semantic call beyond the plan):
   `collectHidden` excludes `drawn` from the hidden pool when `state.win !== null`,
   because a tsumo's win.tile publicly names the tile sitting in the drawn slot.
   Without this the "sibling" would differ in an announced tile. Encoded as
   `drawnHiddenFrom()` with a rationale comment. Ron/ryuukyoku ends hold no drawn
   tile, so the condition only bites at tsumo agari.
2. **Mutant reachability:** the permuted sibling is generally NOT reachable from any
   record — design.md §1 argues (and seatview.ts documents) that seatView is pure
   and total over TableState, so the sibling is a legitimate input; the AC's "fold"
   is satisfied by folding the original record. A record-reachable variant
   (wall-tail permutation + replay) was considered and rejected as strictly weaker.
3. **Cross-suite duplication is deliberate:** `playGreedy`/`playWinEager`/
   `exposedTileIds` etc. are verbatim replicas with origin comments, per the
   dynamics.test.ts "generators are test-local by design" convention. Corpus seed
   facts are cited to dynamics.test.ts as the owning suite — re-mine there first.

## Known limitations / open concerns

- **Corpus fragility by design:** a trajectory-shifting engine change strands the
  pinned seeds (ankan carriers, win carriers). The local coverage guard fails
  loudly in that case; the fix is to re-mine in dynamics.test.ts and mirror the
  lists here. Same posture as the rest of the codebase.
- **`exposedTileIds`/`publicIds` must widen with SeatView:** if a future ticket
  adds a tile-carrying view field (e.g. ura indicators at showdown), both
  collectors need it. This is not a silent hole for *leaks* — the whole-object
  equivalence fails first if the new field carries hidden state — but a public new
  field would be un-audited by the inclusion clause until the collectors learn it.
  Noted in the suite header.
- **Ura-dora does not exist yet** in TableState; when it lands, the unflipped-dead
  handling here (membership by `doraIndicators` ids) already treats it as hidden,
  which is correct until a showdown-reveal field appears.
- No critical issues; nothing needs human attention beyond the three judgment
  calls above. The AC's checkbox in the ticket remains for Lisa to flip.
