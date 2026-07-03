# T-005-02-01 — tsumo-ron-actions-and-fold — Design

Decisions with rationale, grounded in research.md. The blueprint (files,
interfaces, ordering) is structure.md's.

## 1. The action shapes

**Decision:** two new HandAction members:

```ts
| { readonly type: 'tsumo'; readonly seat: Seat }
| { readonly type: 'ron'; readonly seat: Seat; readonly tile: TileId }
```

- `tsumo` records NO tile — the winning tile IS the drawn tile, and the
  seed's wall order is its single authority (the `draw` precedent verbatim,
  record.ts:22–24). Recording it would create a second authority.
- `ron` records the claimed `tile` even though it is derivable from the claim
  window — the chi/pon redundancy precedent (record.ts:29–34): a ron naming a
  tile other than the fresh discard is corruption and throws. This gives the
  AC's "non-winning tile" corruption two distinct loud failures: tile ≠
  window tile (mismatch), and window tile that completes nothing (not a win).
- Both carry `seat` (universal convention). No yaku, winner, or score data in
  the action — the fold derives all of it; logging results would be a second
  authority that could disagree with the derivation.

**Rejected:** encoding ron's target seat (derivable from the window — same
rule that keeps chi/pon from recording `from`); recording the yaku list in
the action (derivation results never enter the log).

## 2. The ended state

**Decision:** `phase` widens by ONE literal — `'agari'` — and TableState
grows a nullable `win` field, non-null exactly when `phase === 'agari'`:

```ts
win:
  | { readonly by: 'tsumo'; readonly winner: Seat; readonly tile: TileId;
      readonly yaku: readonly WinYakuName[] }
  | { readonly by: 'ron'; readonly winner: Seat; readonly from: Seat;
      readonly tile: TileId; readonly yaku: readonly WinYakuName[] }
  | null
```

- A single new phase literal keeps every existing "ended" idiom working
  unchanged: legal.ts's `phase !== 'playing'`, Table.svelte's positive
  literal checks, applyAction's top guard message. `win.by` discriminates
  tsumo from ron — putting `'tsumo' | 'ron'` into `phase` as well would be
  state-side redundancy, which (unlike log-side redundancy) is just two
  fields to desync, with no corruption-detection payoff.
- The discriminated-union shape is the Meld precedent: `from` exists only on
  the ron arm, so "a tsumo with a discarder" is unrepresentable.
- `tile` is the physical TileId (everything in TableState is physical);
  `yaku` is yakuOf's list verbatim — order and content are the aggregator's
  frozen contract, so replay reproducing "the identical win" is automatic.
- TableState is the derived view and may grow fields (record.ts:134–139);
  no stored hand is invalidated.

**Rejected:** `phase: 'tsumo' | 'ron'` literals (redundant with `win.by`);
a structured phase object (breaks string comparison sites); recomputing yaku
on read instead of storing (the gate forces evaluation inside the fold
anyway, and the stored list is what -03's hand-end screen and -04's
determinism suite read).

## 3. Where the winning tile lives (conservation)

- **Tsumo:** the tile stays in the `drawn` slot in the ended state. No zone
  moves; `win.tile` is a reference, not a zone.
- **Ron:** the tile stays counted in the discarder's pond — the claimed-tile
  precedent (record.ts:93–97): ponds keep the complete discard history, and
  `win` (like a meld's `(from, claimed)`) is the mark identifying it there.

The 136-tile partition (hands / melds' own / ponds / drawn / live / dead) is
untouched by winning — T-005-02-04's conservation suite needs no new zone.

## 4. Distinguishing wall from rinshan draws

**Decision:** TableState grows `drawnFrom: 'wall' | 'rinshan' | null`, in
lockstep with `drawn` (null exactly when `drawn` is null). The draw step sets
`'wall'`; applyKanTail sets `'rinshan'` (consecutive kans keep it
`'rinshan'`, correctly); every site that nulls `drawn` nulls `drawnFrom`.
Tsumo's `source` is then a field read. Vocabulary matches Win.source, so the
assembly is a copy, not a mapping.

**Rejected:** a boolean `rinshanDraw` (invents a second vocabulary); deriving
"was the previous action a kan" at tsumo time (applyAction is deliberately
memoryless about the log — state carries all derived facts).

## 5. Houtei: ron out of ryuukyoku, via the pond

Research §3: the wall-emptying discard flips phase to `'ryuukyoku'`
immediately, opens no window — houtei is unreachable as-is.

**Decision:** a ron action is additionally accepted when `phase ===
'ryuukyoku'`, validated against the RECONSTRUCTED final discard: at
ryuukyoku, `turn` stays at the last discarder (already-documented behavior,
record.ts:179–181) and that seat's pond's last tile IS the final discard. Ron
from ryuukyoku targets exactly that tile; the fold transitions ryuukyoku →
agari — the only ended→ended transition, mirroring the real rule that the
houtei-ron check precedes the exhaustive-draw declaration (our fold just
states them in prefix-determinate order).

Why reconstruction instead of retaining the claim window into ryuukyoku:

- "An ended hand never holds a window" (record.ts:190–193) stays literally
  true, along with every test pinning it (dynamics.test.ts:262,
  record.test.ts:523, legal.test.ts:365/375/709) — zero behavioral churn for
  non-win folds; every existing log folds to the identical state.
- The final discard stays chi/pon/kan-proof through the existing ended-phase
  guard for those forms — only ron gets the special arm, which is the rule.
- The houtei window is fully derivable state (`turn` + pond tail); storing it
  in `claimable` would be a second statement of the same fact.

Consequences accepted: `'ryuukyoku'` becomes "provisionally ended" — a fold
ending there can be extended by exactly one ron and nothing else. -02's
legalActions inherits the seam (it must offer houtei ron out of ryuukyoku by
the same reconstruction; its `phase !== 'playing'` early-return gets one
carve-out — noted for that ticket, not changed here).

**Rejected:** keeping the window open on the final discard (breaks the
ended-window invariant and three existing test sites for no representational
gain); a new explicit end-confirmation action (vocabulary widening that
invalidates every stored full-hand log); deferring houtei (the catalog
already defines it, and freezing an ending convention that forbids it would
make later support a breaking fold change).

Haitei needs no special arm: the last live draw leaves `live` empty with
phase still `'playing'` (the flip happens on the DISCARD), so a tsumo folds
normally there; `lastTile = live.length === 0` at the win step covers both
haitei and houtei, and yaku.ts's source checks already keep rinshan wins out
of haitei.

## 6. Multiple ron: the single-winner convention

**Decision:** exactly one ron ends the hand — the fold's ended-phase guard
makes any second ron on the same discard throw ("already ended in agari").
When two or three seats could win the same discard, the RECORDER chooses the
single winner before logging (the app's driver will pick by atamahane — seat
rotation order from the discarder — in T-005-02-03); the fold accepts
whichever single ron the log names, because the fold cannot know who else
could have won without deriving every seat's waits, which is legality's
business (-02), not the step function's.

Documented in record.ts on the ron vocabulary entry (the AC's named home).
Exercised by test: a discard two seats can win → either seat's ron folds
alone to that winner; the two-ron log throws at the second.

**Rejected:** double/triple ron (multiple winners break the singular
winner/tile/yaku reading that -03's screen and -04's suite consume; a
teaching game wants one winner; and since accepting-what-previously-threw is
a compatible widening, a future ruleset variant can add it extend-only);
fold-enforced atamahane (requires the step function to compute other seats'
waits — legality knowledge the fold deliberately doesn't hold).

## 7. Chankan: deferred, documented

shouminkan folds atomically (meld replacement + kan tail in one step); a
robbing ron has no moment to fold into. Supporting it means splitting
shouminkan into announce/complete states — new mid-kan state machinery no
sibling ticket consumes (-02 gates discard ron only). **Decision:** defer;
update record.ts's existing chankan note (record.ts:478–479) to name the
constraint honestly: `source: 'chankan'` remains fold-unreachable until a
ticket restructures shouminkan. The yaku catalog keeps the predicate; no
contract is broken by arriving later (extend-only acceptance).

## 8. Round wind: fixed at East, documented

**Decision:** the fold assembles every Win with `roundWind: '1z'`. Records
are single hands (research §4); round rotation is match-epic structure. A
tonpuusen's hands are all East-round; the future match layer will thread the
true round wind into the fold as an input (optional foldRecord parameter or
record field — that epic's decision, extend-only either way). Consequence
accepted: until then, `yakuhai-round-wind` fires for 1z triplets only, which
is correct for every East-round hand and conservative elsewhere.

**Rejected:** a `roundWind` field on HandRecord now (widening the frozen
record contract for a consumer that doesn't exist yet violates "a hand is
seed + actions and nothing else" more than a documented constant does).

## 9. Guards and evaluation, in the fold's idiom

Fixed guard orders, one loud message per illegal form (applyClaim precedent):

- **tsumo:** turn (wrong seat) → mustDiscard (claim discard owed) → drawn
  present ("before seat drew") → completion (`yakuOf` throws its own
  RangeError on a non-win — the step re-wraps with the action index) → yaku
  gate (empty list → throw "yakuless win is not a win — the one-yaku gate").
- **ron (playing):** window open → not own discard → tile matches window →
  completion → yaku gate.
- **ron (ryuukyoku):** houtei arm — validated against turn-seat pond tail
  instead of the window; same remaining guards.

Evaluation is eager: `yakuOf` runs inside the step, its list lands in
`state.win.yaku`. The AC's three corruptions map to: wrong seat (turn/window
guards), non-winning tile (mismatch guard or empty decomposition), yakuless
(the gate). All RangeError with the action index (uniform corruption signal).

Ron sets `turn = winner` (the claim-jump precedent) and `claimable = null`
(an ended hand never holds a window). Tsumo leaves `turn` (already the
winner) and `drawn` (the tile's zone) in place.

## 10. Seat wind

`seatWind = \`${seat + 1}z\`` — Seat 0 is East the dealer for every record
(deal.ts:15); single-hand records need no rotation. A small typed helper
keeps the cast honest.

## 11. Module placement and tests

Win steps live in record.ts beside the other steps (the fold is the single
authority on what folds; ~+180 lines). record.ts gains a runtime import of
`yakuOf` from yakuman.ts — no runtime cycle (research §5). Tests go in a new
concept-named `win.test.ts` (the dynamics/purity precedent), holding the
mined-seed fixtures and the corruption/convention/replay suites; existing
suites stay untouched by design (§5's zero-churn choice is what buys this).
