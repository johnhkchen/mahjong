# T-005-02-02 — legal-win-offers-and-furiten — Plan

Ordered, independently verifiable steps. Each step names its verification;
commits are per step group. `just test` = vitest over src/core (385 green
today); `just check` = svelte-check + tsc.

## Step 1 — Mine and freeze the new fixtures (no repo changes yet)

Scratchpad scripts (fold + derivation stack only — never the code under test,
which does not exist yet):

1. **Ron+claim coexistence window**: scan seeds × tsumogiri prefixes for a
   window state where (a) some seat completes the fresh discard with yaku and
   no furiten (probe isAgari/waits/yakuOf directly) and (b) another seat holds
   a pon pair (and ideally a chi seat holds run material). Capture: seed, turn
   count, discard tile, the expected offer rows in frozen order.
2. **Furiten window**: continue seed 3951 tsumogiri past turn 35 (seat 3
   tsumogiris its own 4s wait at turn 35); find the next turn where another
   seat's tsumogiri discard is a wait kind (1s/4s/7s). Capture turn + tile;
   verify seat 3 still completes it (isAgari) and waits ∩ pond ≠ ∅.
3. **Re-verify reused anchors** under the same probes: 3951 turn-35 tsumo
   point, 29732 rinshan point, 12754 yakuless window (yakuOf = []), 103897
   houtei (seat 2 completes tile 72 with yaku, not furiten; other seats do not
   complete or are excluded).
4. Check seed 1's maximal-record ryuukyoku: does any seat complete the final
   discard? (Decides the seed-1 'ended' anchor literal in legal.test.ts.)

Verification: script output cross-checked by hand against the captured
constants; constants land only as frozen literals with derivation comments.

## Step 2 — legal.ts: win offers + docs (commit 1)

1. Imports: `isAgari`, `waits`, `yakuOf`, `type WindKind`, `type WinYakuName`.
2. Re-stated constants `ROUND_WIND`, `windKindOf`.
3. Helpers in structure.md's shapes: `winYaku` (single Win-assembly point),
   `discardFuriten`, `ronOffers(state, discarder, tile)`, `tsumoOffer(state)`.
4. `legalActions`: split the ended-hand return (agari `[]`; ryuukyoku →
   `ronOffers` against the reconstructed final discard); window arm inserts
   `...ronOffers(...)` between the draw and `claimOffers`; post-draw arm
   inserts `...tsumoOffer(state)` between the discards and `ankanOffers`.
5. Documentation: header divergence paragraph (furiten: offered ⊂ folds, the
   one deliberate narrowing) + shared-derivation-stack note; `legalActions`
   docstring gains the two win positions and the split ended-hand rule.

Verification: `just check` clean. `just test` EXPECTED partially red (the
three widened properties + ryuukyoku/termination tests may trip on rare
seeds) — red list recorded in progress.md, fixed by steps 3–4. If everything
is green, note that too (the properties' random seeds simply missed tenpai).

## Step 3 — legal.test.ts + dynamics.test.ts widening (commit 2, with step 2
if the suites were already red — one commit must not leave the tree red)

legal.test.ts:
1. Pre-draw property: non-draw offers may be 'ron' (assert window tile /
   not-discarder seat) before the claim block.
2. Claim-order property: locate the claim block after any rons; assert rons
   (if any) all precede it.
3. Post-draw property: tail may include one 'tsumo' by the turn seat before
   the kans.
4. Ryuukyoku tests (property + kan-shortened): every offer, if any, is a ron
   naming the reconstructed final discard.
5. Seed-1 'ended' anchor literal per step 1.4's finding.

dynamics.test.ts:
6. `playGreedy`: drop win offers from `legal` up front; return when nothing
   non-win remains. Comment: the corpus is the ryuukyoku call corpus.
7. Termination property: branch ryuukyoku (exact identities, unchanged) vs
   agari (win non-null, `draws + kans === FULL_TURNS − live.length`, discards
   identity adjusted for the winless-discard endings, ponds/melds identities).
   NB: derive the agari discard identity carefully at implement time — a tsumo
   ends with `drawn` held (one fewer discard than draws), a window ron ends on
   the discarder's counted discard.
8. Greedy-corpus test assertions unchanged — confirm still green.

Verification: `just test` fully green (old 385 + property widenings).

## Step 4 — legal.win.test.ts (commit 3)

The seven describe blocks of structure.md §3, in order: tsumo offers (incl.
rinshan, exact post-discard index, absent-when-incomplete property), ron
offers + frozen-order literal at the mined coexistence window + order
property, furiten (offer absent, fold accepts — the divergence test), the
one-yaku gate (12754 agreement), houtei (exact offer list; agari offers
nothing), and the two-sided win partition over the anchor set (expectations
from isAgari/waits/yakuOf directly).

Verification: `just test` green; new-file test count recorded. Property run
times sane (waits laziness working — no order-of-magnitude suite slowdown vs
main; spot-check `time just test`).

## Step 5 — Full verify + artifacts (commit 4 if any fixups)

1. `just test` (all files), `just check`, `just build` (singlefile emits).
2. AC sweep, one by one against a named test:
   - tsumo offered exactly when the drawn/rinshan tile completes a
     yaku-bearing hand → tsumo describe + partition property.
   - ron ahead of pon/daiminkan/chi in the frozen order → order literal +
     property.
   - no ron when waits ∩ own pond → furiten describe.
   - no offer for yakuless completions → one-yaku describe (both offer
     absence and fold agreement).
3. progress.md kept current per step; review.md written last.

## Testing strategy summary

- Unit/fixture: frozen mined anchors with capture-time derivation comments
  (house precedent; never regenerate).
- Property: offered ⇔ derivation-stack expectation (tsumo); order invariants;
  purity/freshness (existing sweeps cover the new offers automatically since
  they iterate ANCHORS/prefixArb states — no edit needed).
- Agreement: two-sided win partition; the single documented asymmetry
  (furiten) pinned by a directed test on both sides.
- Regression: the widened legacy properties keep every pre-ticket behavior
  pinned (claim orders, kan suppression, staleness, mustDiscard).

## Risks / contingencies

- Mining misses a ron+pon coexistence seed in reasonable time → fall back to a
  scripted tedashi prefix (win.test.ts swaps precedent) to engineer the
  window; the frozen literal still captures a real fold.
- Random property seeds may organically hit win offers rarely → the widened
  assertions make them legal rather than relying on their absence.
- Suite slowdown from yakuOf/waits in hot paths → laziness (D4) is the design
  answer; if `just test` time regresses badly, restrict the expensive gates'
  property run counts (numRuns dials exist in-suite as precedent).
