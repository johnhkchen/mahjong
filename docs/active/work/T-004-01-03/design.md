# T-004-01-03 — legalactions-claim-offers-agreement — Design

Six decisions (D1–D6), each with the rejected alternatives. Grounded in
research.md; the fold's acceptance rules are the fixed other half of the lock.

## D1 — Enumerate every distinct physical-copy combination, not one canonical representative per kind-shape

**Decision.** An offered claim exists for every `uses` combination the fold
would accept, up to ordering: a pon by a seat holding three copies yields
C(3,2) = 3 offers; a chi seat holding two copies of a needed kind yields one
offer per copy; daiminkan/ankan have exactly one combination by arithmetic;
shouminkan has at most one loose fourth copy. Within one offer, `uses` are in a
canonical order (D3), so the offered set is exactly the foldable claim set
modulo uses-permutation.

**Why.** The AC demands "every non-offered claim candidate throws". Only a
complete enumeration makes that a clean two-sided partition: with a canonical-
representative scheme, a candidate using the OTHER copy of a pair folds happily
while never being offered, and the agreement suite would need an equivalence
oracle that reimplements enumeration — the exact circularity the two-statement
design forbids. Completeness is also forward-correct: when red fives arrive,
physical copies genuinely differ (a 5p pon with or without the aka changes the
score), and this enumeration needs no change. Cost is a few extra literals per
rare state — bounded by the copy arithmetic in research.md.

**Rejected.** (a) One offer per kind-shape with canonical copies — breaks the
partition, ages badly against aka dora. (b) Offering every uses PERMUTATION too
— pure noise; the fold is order-agnostic, so the suite normalizes uses order in
its membership key instead (sorted ids), and permuted candidates are simply not
in the candidate space.

## D2 — Full order specification (the deterministic array)

**Decision.** The offered array, by state class:

- ended → `[]` (unchanged).
- `mustDiscard` (post-chi/pon) → the caller's hand discards in hand order.
  Nothing else: no draw, no kans (the fold rejects both). This FIXES the latent
  wrong-offer bug research.md found — today this state offers a draw that
  throws.
- pre-draw (`drawn === null`, not mustDiscard) → the turn seat's draw FIRST,
  then, if a claim window is open: all pon offers, then all daiminkan offers,
  then all chi offers.
- post-draw → the 14 discards exactly as today (hand order, drawn last), then
  ankan offers, then shouminkan offers.

Sub-orders: pon/daiminkan candidate seats scan in rotation order from the
discarder's right ((window.seat+1) % 4 onward — moot today, at most one seat
qualifies, but the loop is principled); pon uses pairs iterate hand-position
pairs i<j; chi shapes iterate low-rank ascending (r−2, r−1, r windows), copy
combinations lower-kind-outer / higher-kind-inner, each in hand order; ankans
in first-occurrence order scanning hand then drawn; shouminkans in the seat's
meld order.

**Why.** "Pon/kan before chi" is the AC verbatim (claim precedence made
positional). Draw-first keeps `offered[0]` the default continuation, preserving
drive.ts's forced-draw arm and the existing "sample by index" blessing; the
14-discard prefix stays byte-identical so post-draw consumers keep their
prefix. Every sub-order is derived from already-frozen orders (hand order,
rotation order, meld order, rank order) — nothing new to freeze.

**Rejected.** (a) Claims before the draw — breaks offered[0] stability and
drive.test.ts for zero benefit. (b) Kans before discards post-draw — would
accidentally preserve drive.ts's last-element hack but breaks the documented
discard prefix and reads backwards (discarding is the common continuation).
(c) Grouping claim offers per seat — indistinguishable today (one claiming
seat) and weaker than type-grouping against the AC's "pon/kan before chi".

## D3 — Canonical `uses` order inside one offer: hand order, drawn last

**Decision.** `uses` list the caller's copies in HAND order (the order they sit
in the hand array); an ankan that consumes the drawn tile lists it LAST. One
exception: chi `uses` are [lower-kind tile, higher-kind tile] — the run read
left to right with the claimed tile removed.

**Why.** Hands are draw-ordered and never sorted (frozen); the discard
enumeration already reads the hand in that order, so offers stay "the hand as
it lies". Drawn-last mirrors the discard enumeration's drawn-last. Chi by run
order matches how every human reads a chi and makes shape variants visibly
distinct in the array. The fold accepts any order, so this is presentation-
determinism only — but it must be FROZEN, because bots sample by index and the
suite pins arrays literally.

**Rejected.** Ascending tile id — indistinguishable for kans (copies of one
kind sort together) but scrambles chi pairs relative to the run and has no
precedent in the codebase; every existing order is hand/rotation/meld order.

## D4 — legal.ts stays independent: re-state the rules, reuse only tiles/deal vocabulary

**Decision.** legal.ts imports types plus `kindOf`/`rankOf`/`suitOf`/
`SEAT_COUNT` and re-states claim legality in enumeration form (which run
windows contain the claimed rank; which seats may pon; kan availability as
`doraIndicators.length - 1 < 4 && live.length > 0`). It does NOT import or
export record.ts internals (`isRun`, `kansMade`, `guardRinshanAvailable`,
`RINSHAN_TILE_COUNT` stay module-local to record.ts).

**Why.** The whole point of the agreement suite is two independent statements
of the same rules — sharing guard code would let one bug satisfy both halves.
The kan count uses the `doraIndicators.length - 1` identity (-02 review point
4): it reads the derived view rather than recounting melds, and is itself
cross-checked by the suite (an enumeration that offers a fifth kan dies on the
fold's guard).

**Rejected.** Exporting shared predicates from record.ts — couples the halves;
a subtly wrong `isRun` would then produce offers the fold accepts, and the lock
is gone.

## D5 — Agreement suite: two-sided lock via normalized keys + candidate sampling + frozen anchors

**Decision.** Three layers in legal.test.ts:

1. **Properties over tsumogiri prefixes** (prefixArb, unchanged generator):
   the structural closed form loosens to "draw first pre-draw / 14-discard
   prefix post-draw, every extra offer a claim naming the open window's tile /
   a kan by the turn seat"; "every offered action folds" stays verbatim (it
   now exercises claim offers for free); order properties assert pon ≺
   daiminkan ≺ chi positionally.
2. **Two-sided candidate partition**: `keyOf` widens to normalize `uses` as
   sorted ids (`type:seat:tile?:sortedUses`). Property: sampled claim
   candidates (random type/seat, tile = window tile or a decoy, uses = random
   distinct hand positions) fold iff their key is offered. Exhaustive anchors:
   at frozen claim-window states, ALL candidates in a documented space — every
   type, every seat, tile = window tile, every hand-position pair/triple (and
   4-subsets incl. drawn for ankan, every tile for shouminkan) — partition into
   offered ⇒ folds / outside ⇒ throws RangeError.
3. **Frozen-literal anchors** pin exact arrays (order + canonical uses):
   seed-1 chi, seed-3 race (pon and chi on one window), seed-67 daiminkan+3-pon
   window and shouminkan post-draw, seeds 161/280 ankan (280's uses include the
   drawn tile), plus suppression anchors — fifth kan (seed 101033), haitei
   ankan (seed 280 with empty live), stale window, mustDiscard states. A
   multi-variant chi anchor (2+ run shapes, duplicate copy) comes from a new
   scratchpad scan, derivation comment + "never regenerate", per convention.

**Why.** Layer 2 is the actual lock the AC names; layers 1/3 pin the parts a
partition cannot see (order, canonical uses, determinism). No expected-offer
oracle is ever built by reimplementing enumeration — expectations are either
fold-derived (throws/folds) or frozen literals.

**Rejected.** Reimplementing a reference enumerator in the test — circular.
Exhaustive 136²-uses candidate spaces — astronomically large; the documented
hand-position space plus sampled decoys covers every guard.

## D6 — Consequential edits: dynamics generator filter, drive.ts tsumogiri fix

**Decision.** (a) dynamics.test.ts `playRecord`/`gameArb` filter the offered
set to draw/discard before choosing — trajectories stay byte-identical to
today; a one-line comment hands claim trajectories to T-004-01-04; its `keyOf`
mirrors the widened serializer. (b) drive.ts `forcedAction` picks the LAST
OFFERED DISCARD (findLast on type) instead of the last element, and its
homogeneity comments update; behavior is identical at every state reachable in
the app today, and a bot post-draw state that now carries kan offers still
tsumogiris instead of silently ankan-ing.

**Why.** Both files break otherwise (research.md): dynamics' exact-140
termination and mutant constructors assume draw/discard-only trajectories;
drive's last-element read returns a kan when one is offered. The -02 precedent
(unplanned keyOf widening, owned in review) says: smallest honest edit, loudly
documented.

**Rejected.** (a) Growing dynamics into claims now — T-004-01-04's charter.
(b) Leaving drive.ts and ordering kans first (D2) — hides the contract change
behind positional luck. (c) Bots that kan whenever possible — a behavior
change smuggled into a legality ticket.
