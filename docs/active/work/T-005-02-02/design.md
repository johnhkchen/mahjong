# T-005-02-02 — legal-win-offers-and-furiten — Design

Six decisions, each grounded in research.md. The shape of the change: legal.ts
grows two offer families (tsumo, ron) and a ryuukyoku carve-out; record.ts does
not change; the agreement suites widen.

## D1. Ron's position: between the draw and the pons (AC-fixed)

At a `drawn === null` state with an open window the enumeration becomes
`[draw, ...rons, ...pons, ...daiminkans, ...chis]`. The AC freezes this ("ron
enumerated ahead of pon/daiminkan/chi"). It sits inside the extend-only promise:
only draw-first and the 14-discard-prefix positions were promised stable — the
claim-block indices were not.

Ron seats scan in rotation order from the discarder's right, the same loop
`claimOffers` uses. Deliberate bonus: rotation order from the discarder IS
atamahane order, so -03's driver can implement head-bump as "take the first
offered ron" without re-deriving anything.

Offer shape: `{ type: 'ron', seat, tile: window.tile }` — records the claimed
tile, mirroring the vocabulary. All simultaneously legal rons are enumerated
(the multiple-ron convention: legality enumerates, the recorder picks one).

## D2. Tsumo's position: after the 14 discards, before the kans

Chosen: `[...14 discards, tsumo?, ...ankans, ...shouminkans]`.

- Mirrors D1 exactly — at each decision class the win offer leads the calls
  while the default continuation (draw / the discards) stays first. One rule to
  document: "win offers precede call offers within their class."
- Alternative (append after shouminkans, maximal index stability) rejected: kan
  indices were never promised stable, and an asymmetric order ("ron before pon
  but tsumo after kan") would make the frozen order harder to state and teach.

## D3. Gating shares the derivation stack; independence stays turn-cycle-only

The offer gates need completion (isAgari), waits (furiten), and yaku (one-yaku
rule). legal.ts will IMPORT `isAgari`, `waits`, and `yakuOf` from its siblings —
the same modules the fold consults — rather than re-deriving any of it.

This is not a breach of the "nothing here imports record.ts guard logic"
doctrine, and the design states why: the doctrine's purpose is that the TURN
CYCLE is stated twice (enumeration vs guards) so a legality bug and a step bug
must agree to slip through. The derivation stack (agari/waits/yaku) is shared
vocabulary — waits.ts names "ron offering" and "furiten gating" as its intended
readers, and re-implementing yaku detection in enumeration form would be absurd
duplication with its own drift risk. The agreement suite still locks the halves:
what legality gates through `waits`/`yakuOf`, the fold gates through
`applyWinTail`'s independent call path.

Two record.ts constants the win context needs — `windKindOf` (`${seat+1}z`) and
`ROUND_WIND = '1z'` — are module-local there, NOT exported. Re-state both in
legal.ts (two lines each). Exporting them instead was rejected: it would create
an import from record.ts beyond types, exactly what the header forbids, to save
four lines. The agreement suite pins that both sides agree (an offered tsumo
folds; a folded win was offered), so the copies cannot drift silently.

## D4. Probe-first evaluation, not waits-first (cost)

`legalActions` runs at every fold step of the dynamics drivers; a `waits` call
is up to 34 isAgari probes. So the gates evaluate lazily, cheapest first:

- Ron, per candidate seat: (1) `isAgari(handKinds + windowKind, melds)` — one
  probe; bail if it does not complete (the overwhelmingly common case).
  (2) Furiten: `waits(handKinds, melds)` — computed only for a completing seat —
  intersected at kind level with `kindOf` over the seat's own pond; bail on
  intersection. (3) One-yaku: `yakuOf(...)` with `source: 'discard'`; offer only
  if non-empty.
- Tsumo: (1) `isAgari(handKinds + drawnKind, melds)`; (2) `yakuOf(...)` with
  `source: state.drawnFrom` verbatim ('wall' | 'rinshan' — the -01 handoff's
  "drawnFrom is the state to read"); offer if non-empty. No furiten: furiten
  restricts ron only.
- `lastTile: state.live.length === 0` in both, mirroring applyWinTail. In the
  playing-phase window arm this is always false (the wall-emptying discard flips
  phase), but the mirrored expression keeps the two sides textually parallel.

Order of gates 2 and 3 for ron is furiten-then-yaku: furiten is O(34 probes)
but pure shape; yakuOf walks every reading. Either order is correct; fixed for
determinism of nothing — just cheapest-reasonable. Waits-membership was NOT
chosen as the completion probe: for a physically-present tile the two are
equivalent (research §4), and the direct isAgari probe is 1/34th the work.

## D5. Furiten gates the OFFER only; the fold stays untouched

The first deliberate divergence between the halves: a furiten ron is never
offered, but `foldRecord` accepts it (record.ts checks no furiten — "knowing
who else could have won is legality's business"). Documented in the legal.ts
header and pinned by a directed test (offer absent, fold accepts).

Alternative — add a furiten guard to applyRon — rejected:
- -01 froze the fold's win semantics; this ticket's contract line is explicit
  that gating lands in legalActions.
- The fold would need `waits` over the winner, importing the one judgment the
  step function's doctrine explicitly disclaims.
- Replay compatibility: any log the fold accepted yesterday must fold
  identically forever; narrowing the fold is a contract change, widening the
  offer set is not.

Scope: BASIC discard furiten only — `waits(hand) ∩ kinds(own pond) ≠ ∅` kills
every ron offer for that seat (whole-seat gate, both window and houtei arms).
Ponds already keep claimed-away tiles counted (Meld contract), so the pond read
is literal. Temporary and riichi furiten are out of scope (no riichi state
exists in core yet); the gate's helper is named for discard furiten so the
riichi ticket extends rather than rewrites.

## D6. The ryuukyoku carve-out mirrors the fold's houtei arm

`legalActions` splits its ended-hand early return: 'agari' offers nothing;
'ryuukyoku' offers the houtei rons — same gates as D4, against the
reconstructed final discard (`discarder = state.turn`, `tile = last of
ponds[discarder]` — the applyRon reconstruction, re-stated in enumeration form;
this pair IS turn-cycle logic, so it is re-stated, not shared, per D3's line).
`lastTile` is true there, so 'houtei' itself satisfies the one-yaku gate; only
completion and furiten can exclude a houtei ron.

## D7. Test strategy

New file `legal.win.test.ts` — the win-offer agreement suite (keeps the 859-line
legal.test.ts from doubling; mirrors helpers per house convention):

- AC row 1 (tsumo): seed 3951 turn-35 draw → tsumo offered at index 14 (after
  the discards, before nothing — no kans there); seed 29732 post-ankan rinshan
  draw → tsumo offered (drawnFrom = 'rinshan'). Negative: the same states one
  turn earlier offer no tsumo.
- AC row 2 (order): a mined window where a ron and a pon (ideally a chi too)
  coexist → frozen full-array literal; plus a property over random tsumogiri
  prefixes: every ron index < every pon/daiminkan/chi index.
- AC row 3 (furiten): seed 3951 continued past turn 35 (seat 3 tsumogiris its
  own wait — 85, 4s) to a later mined window where another seat discards a wait
  kind: ron absent from the offer set, AND the fold still accepts it — the D5
  divergence pinned in one test.
- AC row 4 (one-yaku): seed 12754 turn-2 window — no ron offered, fold throws
  the one-yaku gate; agreement, not divergence.
- Houtei: seed 103897 after 70 turns — offered set is exactly
  `[{ron, seat 2, tile 72}]`; agari states offer `[]` (reuse win.test.ts logs).
- The two-sided win partition at every anchor: for each seat, the tsumo
  candidate and the ron candidate → offered ⇔ (completes ∧ yaku ∧ ¬furiten for
  ron); folds ⇔ (completes ∧ yaku). Expectations derived from the derivation
  stack (isAgari/waits/yakuOf directly), never from legalActions itself.

Widen legal.test.ts minimally: the three tail-type property assertions admit
'ron'/'tsumo'; "ryuukyoku offers nothing" becomes "ryuukyoku offers only houtei
rons" (assert every offer is a ron naming the reconstructed discard — for
near-all seeds the set stays empty); re-verify the seed-1 'ended' anchor's
offered-count literal.

dynamics.test.ts: `playRecord` keeps choosing from the FULL offered set — wins
join the trajectory space (the -01 review's wished-for organic coverage), so
random full games may now end 'agari'. The termination property branches on the
end phase: ryuukyoku keeps the exact identities; agari asserts the win shape,
`live`-adjusted draw identity (draws + kans = consumed live), pond/meld
identities, and conservation. `playGreedy` filters win offers OUT of its pools
(and returns when only wins remain): the greedy corpus exists to guarantee
call-form coverage, and eager wins would truncate games and starve it. Its
ryuukyoku-end assertions then stand unchanged. `isCall` is renamed/adjusted so
tsumo/ron are not "calls" for greed purposes.

## Rejected wholesale

- Offering tsumo/ron from a new module (`offers.ts`): the enumeration is one
  contract with one frozen order; splitting it would put the order's statement
  in two files.
- Caching waits per seat across calls: legalActions is a pure stateless read
  (same state → same array, no memory); performance is handled by D4's laziness.
