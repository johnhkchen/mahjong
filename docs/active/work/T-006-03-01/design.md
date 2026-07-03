# T-006-03-01 — discard-policy — Design

Decision: a new `src/core/policy.ts` exporting one pure function,
`discardPolicy(view: SeatView, offered: readonly HandAction[]): HandAction`,
covering exactly the seat's own-turn decision points — tsumo first, else the
shanten-minimizing discard with a two-key documented tie-break (max distance from
the center rank, then earliest offered), else the draw — and throwing `RangeError`
anywhere else. Rationale below.

## 1. Signature: (SeatView, offered) → HandAction

The ticket dictates the shape, and the codebase confirms it: SeatView's header
says bots take the view, never TableState (fair-play is structural — a policy
typed against SeatView *cannot* peek), and legality stays a full-state concern —
the driver holds the state, computes `legalActions`, projects `seatView`, and
hands both to the policy. The policy never re-derives legality; "element of the
offered set" is guaranteed by *selecting from* `offered`, not constructing
actions. The chosen action is returned **by reference** from `offered` — the
most literal reading of the AC, and `legalActions` already returns fresh
literals per call, so no aliasing hazard exists.

Rejected: `discardPolicy(state: TableState, ...)` — violates the fair-play
doctrine and would let the policy read the wall. Rejected: policy calling
`legalActions` itself — SeatView cannot feed it (by design), and the drive seam
(T-006-03-03) already computes the offered set once per step.

## 2. Scope: three arms, own seat only

Filtering `offered` to `action.seat === view.seat`:

1. **Tsumo offered → return it.** Unconditional, per the AC. Checked first —
   post-draw states offer tsumo alongside 14 discards.
2. **Discards offered → pick by the rule (§3).** Covers both discard-offering
   state classes: post-draw (hand + drawn) and mustDiscard (claim discard owed).
   The policy does not branch on `view.mustDiscard`: the candidate multiset is
   simply `hand ∪ drawn-if-present`, and §5 of research shows both classes land
   on shanten's waiting arity after removal.
3. **Draw offered → return it.** The "draw" half of "discard/draw policy": at a
   pre-draw point the turn seat's default continuation is its draw. This also
   makes the policy total over every own-turn state class.

Anything else — claim windows for a non-turn seat, ryuukyoku houtei, agari —
**throws `RangeError`** naming the contract ("own-turn points only"). That is
the shanten/waits error posture: a policy consulted at a point it does not
govern is caller corruption, not a "pass". Rejected: returning null for
not-my-business — it invites the drive seam to silently swallow states that
T-006-03-02 is supposed to handle deliberately; a throw makes the missing call
branch loud until that ticket lands.

Two deliberate deferrals, both documented in the module header:
- **Kan offers are never chosen.** Ankan/shouminkan appear in the post-draw
  offered set; the discard branch simply doesn't look at them. Declaring kans is
  the call branch (T-006-03-02).
- **An own ron at a pre-draw window is ignored** (the turn seat can hold a ron
  offer on the previous discard while its draw is offered). "Always take a legal
  ron" is T-006-03-02's AC verbatim; taking it here would move that ticket's
  tested behavior into this one. The draw is returned instead — legal, safe,
  replaced when the call branch lands.

## 3. The discard rule: minimize shanten, then a two-key tie-break

For each offered discard, compute `shanten(kinds(hand ∪ drawn − tile),
view.melds[seat])` and take the minimum. Because the drawn tile is itself always
offered (tsumogiri restores the pre-draw hand exactly), the minimum can never
exceed the pre-draw shanten — the AC's "does not raise" falls out of minimality
with no separate mechanism.

**Tie-break, documented:** among minimal discards,

1. **Maximize distance from the center rank** — `|rank − 5|` for numbered
   kinds, honors count as 5 (farther than any numbered tile). Middle tiles have
   the most run potential; shedding the edge-most tile first is the classic,
   *teachable* heuristic — the hint layer can later say "West is an isolated
   honor; 5p can still grow into three different runs." It is also a total,
   RNG-free function of the tile kind alone.
2. **Earliest offered wins remaining ties.** Offered order is contractual
   (hand order then drawn last — legal.ts freezes it) and a deterministic
   function of the SeatView, so this closes every tie — including two copies of
   the same kind and symmetric kinds like 1m vs 9p — without inventing a third
   comparison. Implemented as strict-improvement comparison in one left-to-right
   pass.

Rejected tie-breaks:
- **Offered-order alone** — deterministic and trivial, but plays visibly worse
  (discards the oldest tile in draw order, which is arbitrary) and explains
  nothing; "competent" is the story's bar.
- **Kind-index order** — deterministic but semantically arbitrary (biases
  man over sou); no teaching story.
- **Ukeire maximization** (count advancing tiles among minimal discards) — the
  genuinely stronger heuristic, but ~14 × 34 extra shanten probes per decision,
  a second visibility question (count copies dead in ponds/melds or not — the
  waits.ts exhaustion-convention debate all over again), and a much larger test
  surface. The ticket asks for shanten-minimizing + *a* documented tie-break;
  ukeire is the natural upgrade for a later difficulty/strength ticket, and the
  tie-break here is deliberately isolated in one private comparator so swapping
  it stays local.

## 4. Purity and determinism

No RNG, no Date, no ambient reads: the result is a function of `(view, offered)`
alone. Inputs are never mutated — the candidate multiset is a fresh array; the
comparator reads, never writes. Repeated calls with the same arguments return
the *same element* of `offered` (reference-identical), which is strictly
stronger than the AC's "same action". This is what T-006-03-04's byte-identical
replay leans on.

Trust posture, per the TileId/seed precedent: `view` and `offered` are assumed
mutually consistent (both derived from the same folded state by the driver).
The policy validates its *own* contract (an own-turn offered set) and delegates
arity validation to `shanten` — a malformed hand surfaces as shanten's
RangeError, not a silent bad discard.

## 5. Module shape and naming

New module `src/core/policy.ts` (exported from the barrel), one public function
`discardPolicy`. T-006-03-02 grows the module with the call branch — most
likely a sibling `callPolicy` for claim windows, composed at the drive seam
(T-006-03-03), which already distinguishes own-turn points from claim windows.
Extend-only: this ticket freezes `discardPolicy`'s three arms and its throw on
everything else; the call ticket adds surface, never reshapes this one.

Private helpers: `centerDistance(kind)` (the tie-break key) and a
per-candidate `shantenAfterDiscard`. Nothing else. The comparator stays inline
in one loop — three keys, strict improvement, earliest-wins.

Rejected: folding the policy into legal.ts (legality states choices, policy
makes them — different authorities; legal.ts's header explicitly lists bots as
*consumers*) or into a new `src/core/bot/` subdirectory (two concerns, not
five packages; purity.test.ts's same-directory import rule also assumes flat).

## 6. Testing strategy (detailed in plan.md)

Two layers, per the codebase's example+property convention:

- **Example fixtures on hand-built SeatViews/offered arrays**: tsumo-over-
  discards; the unique tenpai-reaching discard chosen; honor shed over middle
  tile on a shanten tie; 1m-vs-9p symmetric tie falls to offered order;
  mustDiscard (melded) branch; draw branch; RangeError on a claim-window
  offered set; reference-identity determinism.
- **Property sweep over real seeded games**: a test-local driver (the
  dynamics.test.ts pattern) folds seeded records; at every own-turn decision
  point, `discardPolicy(seatView(state, turn), legalActions(state))` returns an
  element of the offered set whose resulting shanten equals the minimum over
  all offered discards and (post-draw) does not exceed the pre-draw shanten;
  tsumo points return the tsumo. Driving the game *with* the policy itself
  doubles as a termination smoke test ahead of T-006-03-04.
