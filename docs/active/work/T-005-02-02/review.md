# T-005-02-02 — legal-win-offers-and-furiten — Review

The handoff: what changed, how it is covered, what a human should look at.

## 1. What changed

| File | Change |
|---|---|
| `src/core/legal.ts` | +~150 lines. New offer families: `ronOffers` (shared by the open-window arm and the new ryuukyoku/houtei arm; seats in rotation order from the discarder — which is also atamahane order for -03's driver) and `tsumoOffer` (turn seat, post-draw, source = `drawnFrom` verbatim). Gates, probe-first: `isAgari` completion → `discardFuriten` (waits ∩ own pond, kind level, ron only) → `winYaku` non-empty (the one-yaku rule; single Win-assembly point mirroring applyWinTail). Re-stated fold constants `ROUND_WIND`/`windKindOf`. `legalActions` now has five state classes: agari `[]`; ryuukyoku → houtei rons on the reconstructed final discard; the window arm inserts rons between the draw and the pons; the post-draw arm inserts the tsumo between the 14 discards and the kans. Header gains THE FURITEN DIVERGENCE paragraph and the shared-derivation-stack rationale. |
| `src/core/legal.win.test.ts` | NEW, 16 tests — see §2. |
| `src/core/legal.test.ts` | Widened, no anchors changed: pre-draw property admits rons (window tile, non-discarder seat, rons-before-claims); claim-order property strips leading rons; post-draw property admits one leading tsumo in the kan tail; the two ryuukyoku tests assert "houtei rons only" (usually the empty set — seed 280's stays exactly `[]`). |
| `src/core/dynamics.test.ts` | `isCall` excludes wins; new `isWin`; `playGreedy` filters win offers (the corpus stays the ryuukyoku call corpus by construction — a non-win offer always remains while playing); the termination property branches agari/ryuukyoku with per-phase end shapes; `expectEndIdentities` generalized: draws + kans === FULL_TURNS − live remaining, and a tsumo leaves exactly one discard obligation unmet (reduces to the old identities at every ryuukyoku). `playRecord` untouched — wins joined the random trajectory space, which was -01's wished-for organic coverage. |

Commits: c183879 (offers + suite widening), 5be697a (the win-offer suite).
Verification: 401/401 tests across 17 files, five consecutive full runs (fresh
fast-check seeds each), svelte-check/tsc clean, `just build` self-contained
single file OK. Suite duration unchanged (~2.4s) — the probe-first gate order
(one isAgari per candidate before any 34-kind waits scan) held the cost.

## 2. Acceptance criteria → coverage

- **Tsumo offered exactly when the drawn or rinshan tile completes a
  yaku-bearing hand** — frozen anchors (seed 3951 turn-35 wall draw at offer
  index 14; seed 29732 rinshan replacement after its ankan, `drawnFrom:
  'rinshan'`) plus a property over random post-draw states: offered ⇔
  isAgari ∧ yakuOf ≠ [] with the expectation computed from the derivation
  stack, never from legalActions itself.
- **Ron ahead of pon/daiminkan/chi in the frozen offer order** — the mined
  seed-4851 window where all three coexist, as a full frozen array literal
  (draw, ron, pon, chi); plus an order property over random windows and the
  widened legacy pre-draw/claim-order properties.
- **No ron offer when the seat's waits intersect its own pond** — seed 23798
  (waits 6p/9p, own 6p tsumogiri'd at turn 9; the turn-20 9p window completes
  with pinfu but is withheld) and its houtei twin (seed 103897).
- **No offer at all for yakuless completions** — seed 12754: no offer AND the
  fold's one-yaku throw (agreement, unlike furiten).

Beyond the AC (the -01 handoff items): houtei offered through the ryuukyoku
carve-out (mined seed 147508, chiitoitsu+houtei, folds to the exact win);
agari offers nothing whichever way it was won; the two-sided win partition
over all eight anchors (offered ⇔ gates; folds ⇔ completes ∧ yaku).

## 3. Design decisions a reviewer should weigh

1. **THE FURITEN DIVERGENCE** — the first place the offered set is
   deliberately narrower than what folds: a furiten ron is never offered but
   the fold accepts it. Grounds: record.ts's frozen doctrine ("knowing who
   else could have won is legality's business, never the step function's"),
   and replay compatibility — narrowing the fold would invalidate logs it
   accepted. Pinned from both sides in two tests (playing arm + houtei arm),
   documented in the legal.ts header. If the project later wants the fold to
   reject furiten rons, that is a record.ts contract change, not a legality
   edit.
2. **The derivation stack is shared vocabulary, not re-stated turn-cycle** —
   legal.ts now imports isAgari/waits/yakuOf, the same modules applyWinTail
   consults. The header's independence rule was scoped: it protects the
   two-sided statement of the TURN CYCLE; re-deriving yaku in enumeration
   form would be drift-prone duplication. The fold constants ROUND_WIND and
   windKindOf ARE re-stated (record.ts keeps them unexported).
3. **Tsumo sits after the 14 discards, before the kans** — mirrors
   ron-before-pon ("win offers precede call offers within their class"); the
   extend-only promise froze only draw-first and the discard prefix, and the
   docstring now records that the claim/kan block indices shifted here.
4. **Basic discard furiten only, whole-seat gate** — temporary and riichi
   furiten are the riichi ticket's extensions; `discardFuriten` is named so
   they arrive as siblings, not edits.
5. **playGreedy avoids wins; playRecord embraces them** — the greedy corpus
   exists to guarantee call-form coverage (eager wins would truncate it);
   random-legal games now legitimately end in agari and the termination
   property asserts both end shapes.

## 4. Test-coverage gaps (known, accepted)

- **No multiple-ron window fixture** — a discard two seats can simultaneously
  ron never turned up in mining range (dealt double-tenpai on the same kind
  is very rare). The enumeration handles it by construction (per-seat loop)
  and the partition property would catch a wrong exclusion at any anchor, but
  no test observes two ron offers on one window. Same gap -01 recorded for
  the fold side; a shanten-based miner would close both.
- **No open-hand (melded) ron/tsumo offer fixture beyond the rinshan ankan**
  — all mined winners are closed tsumogiri hands. The gates pass
  `melds[seat]` through to isAgari/waits/yakuOf, whose own suites cover open
  hands; organic coverage now also arrives through playRecord trajectories.
- **The dealt-hand tenpai bias** — every mined anchor is a seat whose DEALT
  hand is tenpai (the tsumogiri-mining technique's constraint). Hands that
  become tenpai mid-game are exercised only by the random-driver properties.
- **dynamics seat-bump mutation vs double wins** — `withSeat` on a logged ron
  assumes the re-seated ron throws; at an (unmined, astronomically rare)
  double-ron window it would legally fold and the property would fail its
  not-offered precondition. Pre-existing shape of the operator; noted, not
  guarded.

## 5. Open concerns / handoffs

- **-03's driver owns atamahane**: when legalActions returns several rons,
  take the first — the seat scan is rotation order from the discarder, which
  IS head-bump order. Documented on ronOffers.
- **Round wind stays the '1z' fold constant** on both sides (record.ts and
  legal.ts re-statement); the match epic must update BOTH when it threads the
  real round wind through — the agreement suite will catch a one-sided edit.
- **Riichi ticket**: extends this enumeration (riichi declaration offers) and
  adds temporary/riichi furiten as new gates beside `discardFuriten`; the
  win-offer order ("wins precede calls within their class") is now frozen
  contract for it.
- **Performance headroom**: legalActions runs one isAgari probe per post-draw
  call and up to three per window. Suite time is unchanged; if a future bot
  loops legalActions much harder, memoizing waits per (hand, melds) is the
  known lever — rejected here to keep the pure-stateless-read contract.
- No TODOs left in code; no skipped tests; nothing needs human intervention.
