# T-005-02-02 — legal-win-offers-and-furiten — Structure

File-level blueprint. Two modified sources, one new test file, two modified test
files. No new runtime modules, no deletions, no index.ts change (legal.ts is
already `export *`'d).

## 1. `src/core/legal.ts` — MODIFIED (the whole ticket's runtime surface)

New imports (all same-directory siblings, purity-clean):

```ts
import { isAgari } from './agari'
import { waits } from './waits'
import { yakuOf } from './yakuman'
import type { WindKind } from './yaku'
```

(record.ts stays a type-only import; kindOf etc. already imported.)

New module-locals, in file order after `copiesInHand`/`kanAllowed`:

- `const ROUND_WIND: WindKind = '1z'` — re-stated fold constant (D3), same
  comment pointer to the match epic as record.ts's copy.
- `function windKindOf(seat: Seat): WindKind` — re-stated `${seat+1}z`.
- `function winYaku(state, seat, concealedKinds, winningKind, source): readonly WinYakuName[]`
  — assembles the Win literal (melds from state, `lastTile: live.length === 0`,
  seat/round winds) and returns `yakuOf(...)`. Callers guarantee completion
  (isAgari probed first), so yakuOf never throws here. Single assembly point so
  the tsumo, window-ron, and houtei-ron gates cannot drift from each other.
- `function discardFuriten(state, seat): boolean` — `waits(handKinds,
  melds[seat])` ∩ `kindOf(ponds[seat][*])` non-empty. Named for BASIC discard
  furiten; the riichi ticket adds siblings, not edits.
- `function ronOffers(state, discarder, tile): HandAction[]` — the shared
  window/houtei enumerator: seats in rotation order from `discarder + 1`; per
  seat, probe-first gates (isAgari → discardFuriten → winYaku non-empty,
  source 'discard'); emits `{ type: 'ron', seat, tile }`.
- `function tsumoOffer(state): HandAction[]` — [] or the single
  `{ type: 'tsumo', seat: state.turn }`; gates isAgari(hand + drawn kinds) →
  winYaku non-empty with `source: state.drawnFrom!`.

`legalActions` body changes (the four state classes become five):

```
if (state.phase === 'agari') return []
if (state.phase === 'ryuukyoku') {
  // the houtei carve-out: reconstructed final discard (turn's pond, last tile)
  return ronOffers(state, state.turn, lastOf(ponds[state.turn]))
}
if (state.mustDiscard) ...unchanged...
if (state.drawn === null) {
  offers = [draw]
  if (claimable) offers.push(...ronOffers(state, window.seat, window.tile),
                             ...claimOffers(state))
  return offers
}
return [...14 discards, ...tsumoOffer(state), ...ankanOffers, ...shouminkanOffers]
```

Doc changes in the same file (load-bearing, part of the deliverable):

- Header: add the furiten divergence paragraph — the one place legality is
  deliberately NARROWER than the fold (D5), and the D3 note that the derivation
  stack (agari/waits/yakuman) is shared vocabulary, not re-stated turn-cycle.
- `legalActions` docstring: the frozen order gains ron (post-draw-slot, before
  pons) and tsumo (after the 14 discards, before ankans); the ended-hand line
  splits (agari → nothing; ryuukyoku → houtei rons only); the extend-only note
  records that the claim-block indices shifted here, within the promise.

Estimated delta: +110–140 lines (half documentation, per house style).

## 2. `src/core/record.ts` — UNTOUCHED

Explicitly none: the fold's win semantics are -01's frozen contract. The
furiten divergence is documented on the legal.ts side only (record.ts already
carries "knowing who else could have won is legality's business").

## 3. `src/core/legal.win.test.ts` — NEW (the win-offer agreement suite)

Internal organization (mirrored helpers per house convention: `dealtLive`,
`scriptedTurns`, `keyOf` — copied, not imported from other test files):

1. Fixture block: reused seeds from win.test.ts (3951 tsumo/ron, 12754
   yakuless, 103897 houtei, 29732 rinshan) + newly mined constants (a
   ron+claim coexistence window; the seed-3951 post-turn-35 furiten window),
   each with its capture-time derivation comment. Never regenerate.
2. `describe('tsumo offers')` — offered at the mined post-draw points (exact
   index: right after the 14 discards); rinshan variant; absent one turn
   earlier; absent for yakuless/incomplete drawn tiles (property over random
   post-draw states: offered ⇔ isAgari ∧ yakuOf ≠ [] — expectation from the
   derivation stack, never from legalActions).
3. `describe('ron offers and the frozen order')` — the coexistence window's
   full offered array as a frozen literal (draw, ron(s), pons, …); the
   order property over random tsumogiri windows.
4. `describe('furiten')` — the AC gate: wait discarded by the seat itself →
   no ron offer at a later wait window; the same action appended to the log
   STILL FOLDS (the documented divergence, one test, loud comment).
5. `describe('the one-yaku gate')` — seed 12754: no offer, fold throws;
   agreement holds.
6. `describe('houtei')` — ryuukyoku offers exactly the mined ron; agari
   offers []; non-completing/furiten seats excluded in ryuukyoku too.
7. `describe('the two-sided win partition')` — at each anchor: every seat's
   ron candidate and the turn seat's tsumo candidate → offered ⇔ gates;
   folds ⇔ completes ∧ yaku. The furiten row is the only asymmetric cell.

Estimated size: ~300–380 lines.

## 4. `src/core/legal.test.ts` — MODIFIED (minimal widening)

- Pre-draw property: allowed non-draw types gain 'ron'; ron rows assert
  `tile === window.tile`, `seat !== window.seat`.
- Order property ("pon/daiminkan precede chi"): compute the sort check over the
  claim block only (slice from the first pon/daiminkan/chi), and assert any
  rons sit between the draw and that block.
- Post-draw property: tail types gain 'tsumo' (seat = turn seat).
- "ryuukyoku offers nothing" (both tests): retitle to "ryuukyoku offers only
  houtei rons"; assert every offer is `{ron, tile: last of turn's pond}` —
  usually the empty set, so the old expectation is the common case.
- Seed-1 exhaustive 'ended' anchor: re-verify `offered: 0` (adjust literal only
  if seed 1's final discard is genuinely winnable — determined at implement).
- ANCHORS sweeps (fold/purity/freshness) need no edit — they iterate whatever
  legalActions returns.

## 5. `src/core/dynamics.test.ts` — MODIFIED (drivers meet wins)

- `playGreedy`: filter tsumo/ron out of `legal` before pool selection; if the
  filtered set is empty (houtei-only ryuukyoku), return — the corpus stays a
  ryuukyoku call corpus by construction (comment updated to say so).
- `playRecord`: unchanged — wins enter the random trajectory space.
- Termination property: branch on final phase. ryuukyoku → existing exact
  identities; agari → win non-null + phase-appropriate shape (live may be
  non-empty; `draws + kans === consumed live`), ponds/melds identities, and
  `legalActions(state) === []` only for agari (ryuukyoku may offer houtei).
- `expectEndIdentities`: parameterize or split into ryuukyoku/agari variants.
- Greedy-corpus test: unchanged assertions (still ryuukyoku, still all five
  call forms — now guaranteed by the driver filter).

## 6. Ordering of changes

1. Mine fixtures first (scratchpad scripts; frozen constants land in tests).
2. legal.ts implementation + docs — the suites that exist keep running red/green
   visibly against it.
3. legal.test.ts widening + dynamics.test.ts driver changes (existing suites
   green again).
4. legal.win.test.ts (new coverage last, against a stable surface).
5. Full verify: `just test`, `just check`, `just build`.
