# T-004-01-02 — kan-three-forms-rinshan-kandora — Review

Self-assessment and handoff. Read with design.md (the six decisions) beside it.

## What changed

**`src/core/record.ts`** (+~330 lines) — the ticket's entire production surface:

- `HandAction` grew three members: `daiminkan {seat, tile, uses: [3]}` (pon-
  shaped), `ankan {seat, uses: [4]}` (nothing claimed; the drawn tile may be
  among the four), `shouminkan {seat, tile}` (the added copy only — the target
  pon is derivable, a seat can hold at most one pon per kind). The rinshan tile
  and the flipped indicator are NEVER recorded: both are wall-order authority,
  like `draw`'s tile. The rinshan draw is implicit in the kan action — no
  zero-information `draw` is logged, and no "kan declared but not drawn" state
  exists.
- `Meld` became a discriminated union (the seam -01's review reserved): chi/pon
  textually unchanged; `daiminkan`/`shouminkan` carry `claimed`/`from` + 3-tile
  `own`; `ankan` carries 4-tile `own` only. The conservation rule is verbatim
  from -01 — melds contribute `own`; a claimed tile stays counted in its
  discarder's pond. A shouminkan REPLACES the upgraded pon in place (same
  index, `claimed`/`from` preserved), so meld order and the pond mark survive.
- `TableState` grew `doraIndicators`/`doras` (all flips, flip order; [0] is the
  initial). The singular `doraIndicator`/`dora` keep their exact old meaning
  (the initial flip) — Table.svelte and every existing literal compile and pass
  untouched (design D4; the UI ticket migrates to the plurals).
- The step: three module-local apply functions beside `applyClaim`, sharing
  `kansMade` (derived — kan-type melds across seats, never stored),
  `guardRinshanAvailable` (fifth kan; empty live wall), `firstDuplicate`, and
  `applyKanTail`. The tail order is load-bearing: flip `dead[6 + k]` (k = kans
  before this one, computed against the not-yet-mutated array — after k
  shifts + k pushes, original index 6 + 2k sits at 6 + k), then
  `drawn = dead.shift()` (rinshan in frozen draw order), then
  `dead.push(live.pop())` (the tail replacement). The dead wall stays exactly
  14 tiles; ryuukyoku arrives one discard earlier per kan through the UNCHANGED
  phase-flip condition (`live.length === 0` after a discard) — no new phase
  logic anywhere. Guard orders are frozen per form (design D5), every
  rejection a RangeError naming the action index.

**`src/core/record.test.ts`** (+~430 lines): both full-state literals gained
the two plural fields; `allZonesWithMelds` moved from the chi/pon describe to
module level; three new suites (below).

**`src/core/legal.test.ts` / `dynamics.test.ts`** (unplanned, ~4 lines each):
their `keyOf` membership serializers assumed all non-draw actions carry `tile`
— `ankan` broke that at the type level. Serialization now branches on
`'tile' in action` with byte-identical draw/discard keys; one mutant
constructor in dynamics narrows on `'discard'` instead of `'draw'`. No
behavioral change — both suites pass otherwise unmodified.

**Untouched, by design:** `wall.ts` (the frozen dead layout was already
documented there; this ticket consumes it), `dora.ts` (doraKindOf already
handles kan indicators), `legal.ts` (offers are T-004-01-03), `index.ts`
(barrel `export *`), all of `src/app/`.

Commits: `6cf80cb` (state growth), `6046cfa` (kan step + all suites), plus the
artifacts commit.

## Acceptance criteria — verified line by line

- **Rinshan drawn from the dead wall's rinshan positions** — asserted as frozen
  tile literals: 135/56/71 = each anchor's original dead[0]; the seed-56
  two-kan anchor pins the ORDER (dead[0] = tile id 0 first, dead[1] = 127
  second); the four-kan chain consumes all of dead[0..3].
- **Kan-dora flipped rightward from dead[4] per the frozen layout** —
  `doraIndicators` walks [81, 108] (dead[4], dead[6]) on one kan,
  [43, 94, 31] (…, dead[8]) on two, and all five positions
  [4, 6, 8, 10, 12] on four; `doras` cross-checked by hand through the frozen
  dora cycles (3s→4s, 1z→2z, 9m→1m, …).
- **Exhaustive draw one discard earlier per kan** — the seed-280 full hand:
  69 draws and 69 discards (a kanless hand has 70), `phase === 'ryuukyoku'`
  with `live` empty, and the same record minus its final discard still
  `playing` — the flip condition itself untouched.
- **Conservation `hands + melds + ponds + drawn + live + dead == 136` after
  every fold** — asserted at EVERY prefix of seven kan-bearing anchors,
  including the 139-action full hand and the 30-action four-kan chain (so the
  shift/push accounting is checked mid-kan, mid-turn, and at the end).
- **Illegal kans throw** — 21-case matrix, each asserting RangeError + message
  fragment + `action N`: tile not held (unheld uses, the claimed tile doubling
  as a use, the pon's claimed tile as the shouminkan target), wrong form (kind
  mismatches, no owned pon, a chi never qualifying), wrong window/turn/drawn
  state (stale, own-discard, wrong seat, before drawing, while a claim discard
  is owed), empty wall (ankan on the haitei draw), fifth kan, kans after
  ryuukyoku.

## Test coverage

32 new tests (156 total, all green; `just check` and `just build` clean):
6 kan-form positives, 5 wall-accounting (two-kan sequence, ryuukyoku timing,
every-prefix conservation, four-kan exhaustion, determinism + record
immutability), 21 negatives. All expectations are wall-derived or hand-derived
frozen literals with derivation comments (seeds 67 / 161 / 280 / 56 / 101033
from scratchpad scans, cross-checked against capture-time folds, "never
regenerate" per house precedent) — never read back from the fold under test.

**Coverage gaps, deliberate and owned downstream:** no legalActions kan offers
(T-004-01-03 — the agreement suite still doesn't know calls exist); no
property-based generation over kans (T-004-01-04 — today's anchors are
example-based; the every-prefix conservation sweep is the bridge); no ura-dora
(layout reserved, later ticket); no `/verify` app drive — kans are unreachable
from the app until legalActions offers them (the app builds actions only from
the offered set); unchanged app behavior is covered by the untouched drive/SSR
suites and the green build.

## Open concerns for a human reviewer

1. **Immediate kan-dora flip for all three forms (design D4)** is the one rule
   simplification: many rulesets delay the daiminkan/shouminkan flip until
   after the ensuing discard. No consumer can observe the difference yet (no
   ron, no scoring), and revisiting it is one line in `applyKanTail`'s call
   sites plus test updates — but it should be a conscious re-check when the
   agari epic lands, alongside chankan (deliberately absent here).
2. **The `dead[6 + k]` flip arithmetic** is the least obvious line in the step
   (it reads an already-mutated array against the frozen ORIGINAL layout). The
   invariant and its derivation are documented on `applyKanTail`, and the
   seed-56/101033 anchors assert frozen tile literals — an off-by-one cannot
   survive them. Worth a deliberate read anyway.
3. **Suukaikan (four-kan abortive draw) is not implemented** — four kans simply
   play on, and a fifth throws. If the ryuukyoku-variants ticket wants the
   abort, the hook is `kansMade === 4` at the end of the kan step.
4. **`kansMade` recounts melds per kan** (O(melds) per action, ≤ 4 kans per
   hand) — negligible today; if T-004-01-03's enumeration calls it per offered
   action it may want the `doraIndicators.length - 1` identity instead (they
   are equal by construction).
5. **Unplanned `keyOf` widening** in the two sibling test files (see progress
   D3) — worth a glance to confirm the serialization change is as
   behavior-neutral as claimed (draw/discard key strings are unchanged).

No TODOs left in code; no known bugs; nothing skipped silently.
