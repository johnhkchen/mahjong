# Design — T-009-02-01 bot-riichi-policy

## 1. The decision to make

Where, in `discardPolicy`, does the riichi choice slot in, and what is the one documented
exception that turns "declare" into "decline"?

## 2. Where it slots in

`discardPolicy`'s three arms are strictly ordered by precedence (tsumo > discard > draw).
Riichi is itself a *discard* — it fires only when a discard would otherwise fire, at exactly
the tile the discard arm already selects when that tile reaches tenpai. Two placements were
considered:

**Option A — a new arm inserted between tsumo and discard**, independently re-scanning
`offered` for riichi actions, picking among them by its own tie-break (e.g. prefer the
riichi offer whose wait count is highest), then falling back to the existing discard arm
only if no riichi offer survives.

Rejected: this duplicates the shanten scan `riichiOffers` (in `legal.ts`) and the discard
arm (in `policy.ts`) both already perform, and it needs its *own* tie-break among riichi
candidates — a second comparator to design, document, and test, when Research §2.2 already
established that the discard arm's existing comparator, when it bottoms out at shanten 0,
always lands on a tile that has a matching riichi offer. Two comparators for what is
provably the same selection is exactly the kind of arm-reshaping the module's header warns
against.

**Option B (chosen) — extend the existing discard arm in place.** Keep the exact same
scoring loop (shanten, then center-distance, then earliest-offered) to choose `best`,
unchanged. Once `best` is chosen, if `bestShanten === 0`, look up whether `offered` also
contains a `riichi` action for `view.seat` on `best`'s tile. If found *and* the exception
does not apply, return the riichi action instead of `best`; otherwise return `best`
unmodified (covers both "no matching riichi offer exists" — the seat isn't riichi-eligible
at all — and "the exception applies").

Chosen because: (1) it adds exactly one decision point, not a new scan or comparator; (2)
it is provably equivalent in tile choice to a hypothetical independent riichi-tile scan,
per Research §2.2's "same candidate order, same shanten function" argument — so nothing is
lost by reusing it; (3) every existing discard test (none of which include a riichi action
in their curated `offered` arrays) is untouched by construction, since the new branch only
fires when a matching `riichi` action is actually present in `offered`.

## 3. The documented exception: dead wait, not furiten

Two candidates, both computable from `SeatView` alone (Research §2.3–2.4):

- **Self-furiten** (the resulting wait's kinds all sit in `view.ponds[seat]`): legal, and a
  real strategic choice (locks in menzen-tsumo/riichi/ippatsu/ura-dora value even though ron
  is blocked) — declining unconditionally would make the bot *more* conservative than
  correct play, which is a worse "simple rule" than declaring plainly.
- **Dead wait** (`waits(remainder, view.melds[seat]).length === 0` — every completing kind
  is already fully visible to the seat's own hand and melds, so the hand can never complete
  by ron *or* tsumo, ever): this is not a strategic tradeoff, it is a pure mistake — a stick
  staked on a hand that has zero chance to win. No real player would knowingly declare it,
  and it is the "documented exception" version of the same doctrine `legal.ts`'s own
  `discardFuriten` already applies to *ron offers* (a hand fact derivable purely from
  public/own-seat state, independent of legality's own gates).

**Decision: decline exactly when the wait is dead.** Furiten is declared into anyway — a
riichi'd bot may end up furiten and that is accepted, teachable behavior ("you can still
tsumo"), not a bug to route around.

Rule, stated the way the module's header states its other rules:

> Declare the riichi offer matching the discard arm's own chosen tile, unless doing so would
> lock in a wait that can never complete (every kind that would finish the hand is already
> exhausted by the seat's own concealed tiles and melds) — in that case the ordinary discard
> is kept instead, silently, exactly as if no riichi had been offered.

## 4. Rejected alternatives

- **Also gate on a minimum number of draws remaining** (e.g. decline if `view.wallCount` is
  very low): rejected — `riichiOffers` itself already requires `state.live.length > 0`
  (documented in T-009-01-01 as "at least one draw remaining"), so any live-wall floor
  narrower than that would be a second, undocumented threshold with no principled value to
  anchor it to (unlike the dead-wait check, which is a binary, unambiguous "can this ever
  win" fact). Out of scope; a future strength ticket's call, same posture as the discard
  arm's own header ("a stronger tie-break swaps in behind the same comparator").
- **Score/value-aware decline** (e.g. skip riichi on a cheap hand): rejected outright —
  `SeatView` exposes no yaku/han/fu computation and the policy module has never read value;
  wiring `yaku.ts`/`han.ts` into a "should I riichi" decision is a materially bigger, separate
  ticket, not a documented exception to a "declare whenever offered" rule.
- **A brand-new tie-break preferring the riichi offer with the most/best waits** among
  multiple tied shanten-0 candidates: rejected — Research §4's five-way-tie example shows
  this *would* change behavior (it would prefer the live `9m` tanki... no, actually all four
  `1m` copies and `9m` tie at distance 4 too — a waits-count tie-break would only fire when
  center-distance itself is tied, which the existing comparator already resolves via
  earliest-offered). Introducing a second comparator purely to occasionally out-rank
  earliest-offered is exactly the arm-reshaping Option A was rejected for, above, and no AC
  language asks for wait-quality optimization — only "declare whenever offered, unless a
  documented exception."

## 5. Sweep (property test) treatment

The seeded whole-game sweep (`playPolicy` in `policy.test.ts`) will pick up riichi
declarations automatically once `discardPolicy` folds them in — `legalActions` already
offers riichi wherever legal, and the sweep drives every own-turn decision straight through
`discardPolicy`. Two additions, both mirroring an existing pattern in the same file (the
claims-must-be-exercised check, and the discard-arm's per-step shanten oracle):

1. **Non-vacuous**: assert at least one riichi action is folded somewhere across the corpus
   — the branch must actually fire, not just compile.
2. **Per-step soundness**: when `chosen.type === 'riichi'`, independently re-derive that
   removing `chosen.tile` from the pool leaves shanten 0 (the same oracle the discard branch
   already runs, extended to cover the riichi-typed result too, since today's `if
   (chosen.type === 'discard')` guard silently skips it).

No new *decline* assertion is added to the sweep — the dead-wait exception is a genuinely
rare, adversarial hand shape (Research §4 needed a hand-picked construction to trigger it at
all); requiring the random seed corpus to hit it would be flaky-by-construction. Decline
coverage lives entirely in the curated unit test (§3's rule, tested directly), same posture
as `callPolicy`'s "never takes a daiminkan" theorem test, which is also unit-only.

## 6. Determinism

Unchanged: the new branch is a pure function of `(view, offered)` — no RNG, no mutation, and
its result is always either `best` (already an element of `offered`) or a `riichi` action
found *by reference* in `offered` (never constructed). The purity/determinism describe
blocks get one additional fixture apiece (a riichi-containing `offered` array) to pin this
for the new branch specifically, following the existing two-test shape (repeated-call
identity, then structurally-equal-input equality).
