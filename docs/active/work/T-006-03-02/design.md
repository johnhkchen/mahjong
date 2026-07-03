# T-006-03-02 — call-policy — Design

Decision: grow `src/core/policy.ts` with one new pure export,
`callPolicy(view: SeatView, offered: readonly HandAction[]): HandAction`, governing
exactly the claim-window and houtei decision points for one seat: return an own
offered ron unconditionally; else evaluate the seat's own chi/pon/daiminkan offers
against a two-part accept rule — **strict shanten cut** AND **a documented
yaku-anchor predicate** — returning the best accepted claim or, on decline, the
offered draw (the pass); throw `RangeError` when the offered set holds no call
decision for the seat. `discardPolicy` is not touched. Rationale below.

## 1. A sibling export, not new arms on discardPolicy

T-006-03-01 froze discardPolicy's three arms and its throw ("extend-only … the call
ticket adds surface, never reshapes these arms"), and its design.md §5 already
anticipated "a sibling `callPolicy` for claim windows, composed at the drive seam."
The drive seam (T-006-03-03) distinguishes own-turn points from claim windows, so
the composition point exists. Same signature discipline as discardPolicy: typed
against SeatView (fair-play is structural), SELECTS elements of `offered` (never
constructs — "element of the offered set" holds by construction), returns the same
reference on repeated calls, no RNG, no mutation.

Rejected: merging into discardPolicy as new arms — would change its behavior on
inputs it already governs (the own-pre-draw-ron deferral test pins the draw) and
reshape a frozen contract. Rejected: a `CallDecision` result type with an explicit
`pass` variant — there is no pass action in the vocabulary; the AC says "selects
the pass/next-draw" and drive.ts already defines the decline as the offered draw
whose fold lets the window go stale. Returning an offered element keeps the
"element of the offered set" clause literal and uniform.

## 2. The three arms, in order

Filtering `offered` to `view.seat`'s own offers:

1. **Ron arm — unconditional.** An own `ron` offer is returned first, before any
   claim. Legality has already gated it (completion, basic furiten, the one-yaku
   gate), so "always take a legal ron" is pure selection — the policy re-derives
   nothing. This one arm covers both the open-window ron and the houtei ron
   (ryuukyoku offered sets hold only rons), and at most one ron offer per seat can
   exist per window (ronOffers pushes one per completing seat).
2. **Claim arm.** The seat's chi/pon/daiminkan offers are scored by the accept
   rule (§3). If any is accepted, the best accepted claim is returned (§4's
   tie-break); otherwise the DECLINE is the offered `draw` element — the turn
   seat's default continuation, per the drive.ts pass doctrine. The draw may
   belong to another seat; the policy still only *selects* it, and the AC's
   "selects the pass/next-draw" sanctions exactly this.
3. **Nothing for this seat → RangeError.** No own ron, no own claim offer: there
   is no call decision here (a houtei set without this seat's ron, an agari set,
   a post-draw set). The discardPolicy posture verbatim: consultation at a point
   the policy does not govern is driver corruption, not a pass. The turn seat
   holding no window offers is also a throw — its decision is discardPolicy's
   draw arm, and giving callPolicy a silent overlap would blur the seam.

## 3. The accept rule: strict cut + yaku anchor

A claim is accepted iff BOTH hold:

**(a) It strictly lowers shanten.** `shanten(hand ∖ uses ∪ {claim-as-meld})` —
for chi/pon the 11−3m remainder sits at the drawn arity for m+1 melds, and a
14-arity hand always has a shanten-preserving discard, so the value IS the best
reachable post-claim-discard shanten — compared against `shanten(hand, melds)`
(the min-of-three combinator on both sides, so a chiitoi/kokushi-shaped hand
that would lose its cheap form by opening is priced automatically: the arms drop
out at the first meld). Accept requires `post < pre`, the AC's "lowers shanten"
verbatim.

A consequence worth naming: **daiminkan can never be accepted.** Melding a
concealed triplet leaves standard shanten unchanged (the meld discount exactly
replaces the set the triplet already counted as) and can only lose the
chiitoi/kokushi arms, so `post < pre` never holds — the policy structurally never
opens a kan, as a theorem of the cut rule rather than a special case. That is
also sound play for a teaching bot (an open kan reveals the hand and gambles
kan-dora), and it satisfies the ticket's "chi/pon/kan" scope: kan claims flow
through the same rule and are deliberately declined, with a test pinning it.

**(b) A yaku stays reachable — the anchor predicate.** No reachability machinery
exists (yakuOf evaluates completed hands only), so this ticket defines one:
documented, conservative, teachable. Over the POST-call hand (concealed
remainder + melds including the new claim), a yaku anchor holds iff either:

- **Yakuhai anchor**: some meld is a triplet-class set of a VALUE kind (haku 5z,
  hatsu 6z, chun 7z, the seat wind `${seat+1}z`, or the round wind — re-stated
  '1z', the legal.ts/record.ts convention), or the concealed remainder holds ≥ 2
  copies of one value kind (a pair that can still become the yakuhai triplet).
- **Tanyao anchor** (kuitan is allowed — yaku.ts fixes that convention): every
  tile of every meld is a simple, AND the concealed remainder holds at most
  `post-shanten + 1` non-simple tiles — the claim discard plus one shed per
  remaining exchange can clear the offenders without stalling the hand. A
  deliberate heuristic bound, not an exact reachability proof, and documented
  as such in the module header.

Two anchors only, on purpose: yakuhai and kuitan are the two canonical open-hand
plans, the hint layer can articulate both in one sentence ("no yaku would remain:
the hand can't go all-simples and holds no value pair"), and the predicate is a
total, RNG-free function of the post-call hand. Rejected alternatives:

- **Exact reachability search** (min exchanges to each open-compatible yaku) —
  a combinatorial search per offer with no existing machinery, unverifiable by
  eye in tests, and far past "competent" for a teaching bot.
- **More anchors** (toitoi, honitsu, chanta…) — each adds test surface and
  decline/accept edge cases; the predicate is one private function, so widening
  it later is a local, extend-only strength upgrade (more accepts, never
  reshaped arms) for a difficulty ticket.
- **No predicate** (cut-only) — accepts yakuless opens; the AC's decline clause
  and the one-yaku win gate make that a mechanical dead end (an open yakuless
  hand can reach tenpai but is never OFFERED a win short of houtei/haitei luck).

The predicate applies to every claim uniformly — a hand already open and already
anchored (e.g. an existing yakuhai pon) passes via its melds; a closed hand
weighing its first call is priced the same way. Riichi does not exist in the
vocabulary yet, so "stay closed for riichi" is deliberately not modeled.

## 4. Tie-break among accepted claims: earliest offered, alone

**The first accepted offer in offered order wins.** A "minimal post-shanten"
primary key was considered and dropped as vestigial: an accepted chi/pon always
cuts shanten by EXACTLY one. Sketch: cut = 2 + v′ − v (the block-count values
before/after; the meld contributes the flat 2), and the claim's `uses` always
form a countable proto-block (any two tiles completing a run with the window
tile are at distance ≤ 2; a pon's uses are a pair), which at 13 concealed tiles
always has a free block-or-head slot (saturating four blocks plus a head takes
14 tiles) — so v′ ≤ v − 1; and the cap shrinking from 4 − m to 4 − (m+1) blocks
bounds the other side. Every accepted offer at a window therefore ties on post-
shanten, and offered order — contractual, deterministic: pons before daiminkans
before chis, chi shapes low-rank ascending, copies in hand order — is the whole
tie-break, encoding pon-over-chi claim precedence for free. One left-to-right
first-accepted-wins pass, same-reference determinism, the discardPolicy mold.

## 5. Who is consulted, and multi-seat arbitration

callPolicy decides for ONE seat. At a window several seats may hold offers; which
single action folds is the DRIVER's arbitration (T-006-03-03 / the sweep driver
here): consult each seat holding window offers, and among non-draw answers fold
the earliest in offered order — which is exactly ron-before-claims, atamahane
rotation among rons, and pon-before-chi among claims (legal.ts froze that order);
fold the draw when every consulted seat declines. The multiple-ron convention
(record.ts: the recorder picks one) is satisfied by the same rule. This ticket's
seeded sweep implements that driver in-test, rehearsing the seam.

## 6. Scope boundaries

- **Own-turn ankan/shouminkan stay unchosen.** They live in post-draw offered
  sets, which discardPolicy governs and this ticket must not reshape. Both are
  shanten-neutral-or-worse under the same cut lens, never yaku-stranding but
  also never advancing; choosing them is a later strength ticket. The module
  header's kan note is updated to say the claim-side kan (daiminkan) is now
  governed — and declined — by callPolicy.
- **discardPolicy unchanged**, tests included (the own-pre-draw-ron deferral test
  keeps pinning the draw; the DRIVER stops consulting discardPolicy at windows
  once T-006-03-03 lands).
- **No drive.ts changes** — that is T-006-03-03 by dependency graph.

## 7. Testing strategy (detailed in plan.md)

Fixture layer (tileSource/viewOf molds): ron over claims; houtei ron; yakuhai-pon
accept (cuts shanten, anchor via new meld); kuitan-chi accept (anchor via
all-simple melds + clean remainder); decline on anchor failure (open yakuless —
the AC's strand case) returns the offered draw element; decline on cut failure
(pon that does not lower shanten) despite an anchor; daiminkan never accepted
(the theorem, pinned); accepted-claim tie-break (min shanten, then earliest
offered); RangeError on no-decision sets; purity/determinism (same reference, no
mutation, structural-equality stability).

Sweep layer: extend the policy.test.ts seeded driver — at claim windows consult
callPolicy for every seat holding offers and arbitrate per §5; assert per step:
element-of-offered, ron-always-taken, every accepted claim strictly cuts shanten
and satisfies the anchor predicate (re-derived test-side), games terminate within
ACTION_BOUND (calls only shorten games — skipped seats draw nothing), and the
same seed replays a byte-identical action list (the T-006-03-04 rehearsal, now
with calls in the log).
