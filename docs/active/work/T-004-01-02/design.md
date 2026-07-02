# T-004-01-02 — kan-three-forms-rinshan-kandora — Design

Decisions with rationale, grounded in research.md. Six decisions carry the
ticket: action encoding, Meld widening, rinshan + wall-shortening mechanics,
kan-dora state, step semantics per form (with the implicit-rinshan call), and
placement — then the test strategy.

## D1 — Action encoding: three flat members, `uses`/`tile` per the redundancy rule

```ts
| { type: 'daiminkan'; seat: Seat; tile: TileId; uses: readonly [TileId, TileId, TileId] }
| { type: 'ankan';     seat: Seat; uses: readonly [TileId, TileId, TileId, TileId] }
| { type: 'shouminkan'; seat: Seat; tile: TileId }
```

- **Three flat members (chosen)** over one parameterized `kan` type: the frozen
  vocabulary style is flat (draw/discard/chi/pon are separate members), and the
  three forms have genuinely different shapes — daiminkan is a claim (window
  semantics, claimed tile + 3 exposed), ankan is 4 own tiles and no claim,
  shouminkan is a single added tile. T-004-01-01 D1 predicted exactly this.
- **daiminkan** mirrors pon: `tile` is the claimed discard (deliberate
  redundancy — wrong tile = corruption, throws), `uses` the three physical
  copies leaving the hand (the player's choice of nothing — all three held
  copies must go — but the log states what is exposed, and the guard catches a
  log that disagrees with the hand).
- **ankan** records `uses` only: there is no claimed tile. The four ids name
  which tiles leave hand+drawn — necessarily all four copies of one kind, but
  recording them keeps the guard style (unheld/duplicate ids throw by name)
  and the red-five future intact.
- **shouminkan** records the added `tile` only. The target meld is derivable —
  a seat can hold at most one pon of a kind (4 copies exist; a pon consumes 3)
  — so recording a meld index would be a second authority over the meld list.
  The added tile is technically derivable too (only one copy remains), but
  recording it is the seat-tag redundancy: an action naming a tile the seat
  does not hold is corruption and throws by name.
- **Rejected: recording the rinshan tile or the flipped indicator** in any kan
  action. Both are wall-order-derivable (the frozen dead layout); recording
  them would create the second authority the `draw`-records-no-tile convention
  exists to prevent.

## D2 — Meld widening: discriminated union, `own` on every member

```ts
type Meld =
  | { type: 'chi' | 'pon'; claimed: TileId; from: Seat; own: readonly [TileId, TileId] }
  | { type: 'daiminkan';   claimed: TileId; from: Seat; own: readonly [TileId, TileId, TileId] }
  | { type: 'shouminkan';  claimed: TileId; from: Seat; own: readonly [TileId, TileId, TileId] }
  | { type: 'ankan';       own: readonly [TileId, TileId, TileId, TileId] }
```

- The widening T-004-01-01 review.md reserved ("ankan has no claimed tile" —
  Meld is derived view, not record contract). A discriminated union keeps
  chi/pon literally unchanged (no test literal moves) and makes
  claimed-absence a type fact, not a null check.
- **`own` on every member is the load-bearing choice**: the conservation
  partition stays "melds contribute their `own` tiles" verbatim, and the
  existing flatten `melds.flat().flatMap(m => m.own)` keeps working across all
  five shapes. Daiminkan's claimed tile stays counted in the discarder's pond
  (D4 of -01 carries over unchanged — the pond is the discard history and
  `(from, claimed)` the mark). Ankan's four tiles are all `own`.
- **Shouminkan upgrades the pon in place** (same index in `melds[seat]`,
  `claimed`/`from` preserved, `own` = pon's pair + the added tile). Meld order
  stays claim order; the pond mark survives the upgrade. Rejected: appending a
  new meld and removing the pon (reorders the list, briefly double-counts) or
  a nested `{pon, added}` shape (every consumer unwraps forever).

## D3 — Rinshan + shortening: consume dead[0], replenish from the live tail

Per kan, in one atomic step: `drawn = dead.shift()` (the rinshan draw — after
k prior kans the front of the mutated dead array IS original dead[k], so no
counter arithmetic is needed for the draw), then `dead.push(live.pop())` (the
haitei replacement moving to the dead wall).

- **(a) Physical replenishment (chosen).** Everything the AC asks for falls
  out: the live wall shortens by exactly one per kan, so the discard that
  empties it — ryuukyoku — arrives one discard earlier per kan **through the
  existing, untouched phase-flip condition** (`live.length === 0` after a
  discard). The "ended exactly when live is empty" invariant and the
  14-tiles-always dead-wall invariant both survive verbatim. Conservation is
  trivial: the rinshan tile moves dead→drawn, the tail tile live→dead, every
  id still in exactly one zone.
- **(b) No replenishment + `live.length === kanCount` end condition.**
  Rejected: breaks "ended exactly when live is empty", threads a counter
  through the phase logic and every future haitei/houtei consumer, and leaves
  dead at 13/12/… against the documented always-14 invariant.
- **(c) Keep `dead` frozen, exclude drawn rinshan by bookkeeping.** Rejected:
  the partition rule is "every id lives in exactly ONE zone"; a tile counted
  in dead while held as drawn is precisely the double-count the rule forbids.
- `live.pop()` takes the TAIL — live[0] stays the next normal draw, matching
  the physical rule (the haitei tile is walled off, not the next draw).

## D4 — Kan-dora state: additive plural fields; flip is immediate

```ts
doraIndicators: TileId[]   // every flipped indicator, flip order; [0] is the initial
doras: TileKind[]          // doraKindOf of each, same order
```

- **Additive plural (chosen).** The existing singular `doraIndicator`/`dora`
  keep their exact documented meaning ("the flipped physical indicator —
  dead[INITIAL_DORA_INDICATOR_INDEX]", i.e. the initial flip) — Table.svelte:72
  and both full-state test literals keep compiling and passing untouched.
  Reshaping the singulars into arrays was rejected on the T-004-01-01 D4(c)
  precedent: reshaping an existing field spends every consumer's compatibility
  for information the plural already carries. The UI ticket migrates the view
  to the plural when it renders kan-dora.
- **Flip position** is the frozen layout's rightward walk: the j-th kan
  (1-based) flips original dead index `4 + 2j`. Inside the step this is read
  as `dead[6 + k]` where k = kans made so far *before* this one, flipped
  BEFORE the shift/push mutate the array (after k shifts and k pushes,
  original index `6 + 2k` sits at `6 + 2k − k`). k itself is derived, not
  stored: the count of kan-type melds across all seats (`doraIndicators.length
  − 1` always equals it; the meld count is the semantic truth, the indicator
  list follows).
- **Timing: every kan flips immediately**, inside the kan step, before the
  ensuing discard. Real-world rulesets delay the daiminkan/shouminkan flip
  until after the discard (uradora-timing variants); the ticket's contract
  sentence — "every kan … flips the next kan-dora indicator" — is the simple
  immediate rule, and no consumer yet exists that can observe the difference
  (no ron, no scoring). Documented as a conscious simplification; revisiting
  it later changes one line in the step and no stored record.

## D5 — Step semantics (the contract, precisely)

All three forms share a tail once validated: expose/upgrade the meld → flip
`dead[6 + k]` onto `doraIndicators`/`doras` → `drawn = dead.shift()` →
`dead.push(live.pop())`. The rinshan draw is **implicit in the kan action** —
no separate `draw` is logged: the tile is wall-order-derivable, and after a
kan no other action can legally intervene (chankan is an agari-epic concern),
so a logged draw would be a mandatory zero-information action and an illegal
"kan declared but not yet drawn" state. After the tail, `drawn` is non-null,
so the EXISTING discard step handles the rinshan discard unchanged (tsumogiri
or tedashi-append), reopening the claim window as any discard does.

Guard order per form is frozen (each illegal kan named by exactly one
message, RangeError with the action index):

- **daiminkan**: window open (else "no claimable discard") → not the
  discarder's own → `tile === window.tile` → rinshan available (kans made <
  4; live non-empty — unreachable through a legal fold since an open window
  implies live ≥ 1, kept loud) → uses distinct → uses held → all four kinds
  equal. Then the tail with: turn = seat (the jump — skipped seats never
  draw), claimable = null, mustDiscard stays false (the rinshan draw replaces
  the claim-discard obligation with the ordinary drawn-tile obligation).
- **ankan**: seat === turn → not mustDiscard (a chi/pon caller owes a discard,
  never a kan) → drawn ≠ null (an ankan happens mid-draw) → rinshan available
  (kans < 4; live non-empty — REACHABLE here: the haitei draw leaves live
  empty while playing, and kanning it must throw: nothing to replenish) →
  uses distinct → each use in hand or === drawn → all kinds equal. Apply:
  remove uses from hand/drawn; if drawn was not among uses it is APPENDED to
  the hand (the tedashi-append precedent); push `{type:'ankan', own: uses}`;
  tail. Turn unchanged.
- **shouminkan**: seat === turn → not mustDiscard → drawn ≠ null → rinshan
  available (as ankan) → `tile` in hand or === drawn → the seat owns a pon of
  `kindOf(tile)` (else "wrong form": no pon to extend). Apply: take `tile`
  from hand or drawn (appending a surviving drawn to the hand as above);
  replace the pon in place per D2; tail. Turn unchanged.

A fifth kan of any form hits "rinshan available" (four rinshan tiles exist —
the dead-wall-exhaustion case T-004-01-04 will mutate against). The
four-kan-abort rule (suukaikan) is a hand-ending variant owned by a future
ryuukyoku-variants ticket, not here — four kans simply play on.

## D6 — Placement: extend record.ts; no new module

Kan validation and application are step semantics; record.ts stays the step's
single authority (T-004-01-01 D5's reasoning holds verbatim — legal.ts is
T-004-01-03's, extraction before a second consumer is speculation). The shared
tail is one module-local helper beside `applyClaim`. record.ts grows ~150
lines; still one legible module. `legal.ts`, `wall.ts`, `dora.ts`, `deal.ts`,
`dynamics.test.ts`, `legal.test.ts`, and all of `src/app/` untouched.

## Test strategy (record.test.ts, per the AC)

House rules hold: expectations wall-derived or hand-derived frozen literals
with derivation comments ("never regenerate"), never read back from the fold
under test. Anchors need rarer shapes than chi/pon — a scratchpad seed scan at
implement time locates: (1) a seat holding three copies of a kind with the
fourth reachable as another seat's early discard (daiminkan); (2) a seat
drawing into four copies (ankan — including one anchor where the drawn tile is
among `uses` and one where it is not, to pin the append rule); (3) a pon
followed by the caller obtaining the fourth copy (shouminkan — the caller may
simply keep a third held copy at pon time and add it on a later turn). Chains
may use tedashi to route tiles; every prefix stays a legal fold.

Coverage: per-form positive folds (meld shape, hand shrinkage, turn behavior,
`drawn` = original dead[k], dead stays 14 and contains the moved tail tile,
`doraIndicators`/`doras` growth with hand-derived kinds, live shortened);
rinshan/indicator sequence over two kans in one hand (dead[0] then dead[1];
dead[6] then dead[8], original indices); ryuukyoku one discard earlier (a
full-hand record with one kan ends after 69 normal turns — asserted through
the unchanged phase-flip, live empty exactly at the end); conservation of all
136 ids at EVERY prefix of the kan anchors via the widened flatten; double-
fold determinism + record immutability over a kan-bearing record; and the
illegal-kan matrix through the `expectClaimThrows` pattern — per form: wrong
window/turn/drawn state, wrong tile, duplicate uses, unheld uses (the claimed
tile doubling as a use included), kind mismatch, shouminkan with no matching
pon, kan while a claim discard is owed, ankan on the empty-wall haitei draw,
fifth kan, kan after ryuukyoku. Existing suites stay green: both full-state
literals gain the two plural fields; nothing else moves.
