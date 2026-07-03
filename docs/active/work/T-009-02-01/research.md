# Research — T-009-02-01 bot-riichi-policy

## 1. Ticket ask

Bots must declare riichi on purpose: extend the existing pure policy (`src/core/policy.ts`)
with a documented, deterministic rule — "declare whenever riichi is offered, unless a
documented exception applies" — reading nothing beyond `SeatView`, choosing only from the
offered set (never constructing actions), same as every other decision the policy already
makes. Depends on T-009-01-01 (riichi declaration mechanic, `status: done`, merged to main).

## 2. What exists today

### 2.1 The policy module (`src/core/policy.ts`, `policy.test.ts`)

Two pure functions, both `(view: SeatView, offered: readonly HandAction[]) => HandAction`:

- `discardPolicy` — own-turn decision points. Three arms in order: (1) an offered `tsumo`
  for `view.seat` wins unconditionally; (2) among offered `discard` actions for `view.seat`,
  score each candidate tile by the shanten of the hand with that tile removed, and pick the
  minimum, tie-broken by center-distance (`|rank − 5|`, honors = 5, farther wins) then by
  earliest-offered; (3) fall back to the offered `draw`. Throws `RangeError` if none apply —
  "own-turn points only."
- `callPolicy` — claim windows and houtei. Ron first, unconditionally; then claim offers
  (chi/pon/daiminkan) scored by a strict-shanten-cut-plus-yaku-anchor accept rule, first
  accepted offer wins, tie-broken by earliest-offered; declining returns the offered draw.

Both are read-only, deterministic, and select an element of `offered` — never construct a
new `HandAction` literal. This is the pattern to extend, not replace.

The module's header doc-comments are long, deliberate design notes — precedent for how this
ticket's own additions should be commented (why, not what; each arm's tie-break named and
justified).

### 2.2 The riichi vocabulary (`src/core/record.ts`, `src/core/legal.ts`, done in T-009-01-01/02/03)

`HandAction`'s `riichi` variant: `{ type: 'riichi'; seat: Seat; tile: TileId }` — one atomic
declare-and-discard motion, `tile` meaning exactly what a `discard`'s `tile` means (the tile
leaving the hand). Folding it (`applyRiichi` in `record.ts`) locks the seat
(`TableState.riichi[seat] = true`), moves a 1000-point stick into the pot, and (from that
point on) forces every later discard by that seat to be tsumogiri only.

`legal.ts`'s `riichiOffers(state)` (only ever called at a post-draw, turn-seat point):

```
function riichiOffers(state: TableState): HandAction[] {
  const seat = state.turn
  if (state.riichi[seat]) return []
  if (!isMenzen(state.melds[seat])) return []
  if (state.scoresIn[seat] < RIICHI_STICK) return []
  if (state.live.length === 0) return []
  const hand = state.hands[seat]
  const drawn = state.drawn!
  const candidates = [...hand, drawn]
  const offers: HandAction[] = []
  for (const tile of candidates) {
    const remaining = candidates.filter((t) => t !== tile)
    if (shanten(remaining.map(kindOf), state.melds[seat]) === 0) {
      offers.push({ type: 'riichi', seat, tile })
    }
  }
  return offers
}
```

Key facts this derives:

- **Candidate order is identical to the ordinary discard offers'**: both iterate
  `[...hand, drawn]` — hand tiles in hand order, drawn tile last. `legalActions`'s frozen
  enumeration confirms this: `...hand-discards, drawn-discard, ...riichiOffers(state),
  ...tsumoOffer(state), ...` — riichi offers sit immediately after the 14 discards, in the
  same relative tile order.
- **A riichi offer exists for tile T iff discarding T reaches shanten 0** (tenpai) — the
  *only* per-tile condition; the seat-wide gates (not already locked, closed hand, score,
  wall) are checked once, before the loop, and are exactly the conditions under which the
  ordinary discard tie-break's minimum could even be 0 in the first place (shanten 0 is the
  global floor, so if any candidate reaches it, the discard arm's minimum-shanten scan lands
  on 0 too). **Consequence for the policy: whenever `discardPolicy`'s existing discard-arm
  tie-break already lands on `bestShanten === 0`, its chosen tile is *guaranteed* to also
  have a matching `riichi` offer in `offered` — same tile, same seat** (verified empirically,
  see §4). No new shanten-scanning or tie-break is needed to find the tile; only a
  side-lookup into `offered` for the matching riichi action.
- Riichi offers are **not gated by furiten** (`ronOffers`/`discardFuriten` are a separate
  concern, checked only for *ron*, never for *riichi itself*). Nor are they gated by whether
  the resulting wait can ever physically complete — `riichiOffers` only checks
  `shanten === 0`, a purely structural (kind-count) property, blind to how many copies of the
  winning kind(s) are already visible in the seat's own hand/melds.

### 2.3 `waits.ts` — the "can this tenpai actually complete" datum

`waits(concealed: TileKind[], melds: Meld[]): TileKind[]` — every kind that completes the
13-tile hand to agari **and can still physically arrive**. Its own doc-comment names the
exhaustion convention explicitly: a kind all four of whose physical copies are already
visible to the hand *itself* (concealed tiles + its own melds' tiles) is never a wait,
because it "can neither be discarded by an opponent (ron) nor remain in the wall (tsumo)."
This is *not* the same predicate as `shanten() === 0`: shanten operates on tile kinds only
(counts), with no notion of how many physical copies are visible; `waits` additionally
checks the exhaustion condition. **A hand can be structurally tenpai (`shanten === 0`) with
zero real waits** — confirmed empirically (§4): `1111m234p567p789s` (13 concealed tiles, no
melds) is `shanten === 0` (reads as `111m` set + a `1m` tanki pair-wait) but
`waits(...) === []`, because all four copies of `1m` are already in the hand.

`legal.ts`'s own `discardFuriten` is the precedent for computing furiten/wait-quality facts
*independently of legality*, purely from a seat's own public state:
`waits(state.hands[seat].map(kindOf), state.melds[seat])` intersected with the seat's own
pond (`state.ponds[seat]`) — every input here (`hands[seat]`, `melds[seat]`, `ponds[seat]`)
is a field `SeatView` already exposes for `view.seat`. Nothing new needs to be added to
`SeatView` to compute either furiten or dead-wait facts for the policy's own seat.

### 2.4 `SeatView` (`src/core/seatview.ts`)

Exposes, relevant to this ticket: `hand`, `drawn`, `melds` (all four seats'), `ponds` (all
four seats'), `riichi` (lock status, all four seats), `pot`. **Does not expose**
`tempFuriten`/`riichiFuriten` (TableState-only fields) or any seat's running score
(`scoresIn`) — these are not derivable from `SeatView` at all. Any policy rule this ticket
writes must work from `hand`/`drawn`/`melds`/`ponds` alone (plus the offered set), matching
the ticket's own constraint ("still reading nothing beyond SeatView").

### 2.5 The seeded whole-game sweep (`policy.test.ts`, bottom third of the file)

`playPolicy(seed)` drives a full hand end-to-end using `discardPolicy`/`callPolicy`
exclusively for every decision, re-deriving an independent oracle at each step (shanten
minimality for discards, strict-cut-plus-anchor for claims, offered-set membership for
everything). It currently has **no riichi-specific assertion** — a `chosen.type === 'riichi'`
result would flow through untouched (pushed to `actions`, folded on the next
`foldRecord`), but nothing confirms it was sound, and nothing confirms riichi is ever
exercised at all (mirroring the existing "claims must be non-zero across the corpus" check
for the claim branch).

## 3. Constraints and conventions this ticket must honor

- **Extend-only, no arm reshaping.** The header doc-comment states this explicitly for both
  existing arms ("a stronger tie-break swaps in behind the same comparator without touching
  the arms"); T-009-01-01's own review notes the same convention held for `legalActions`.
  The new riichi step should slot in as an *addition* to the existing discard arm, not a
  rewrite of it.
- **Selection, not construction.** The chosen action must be `===` (reference-identical) to
  an element of `offered` — the purity/determinism tests assert this generically
  (`expect(offered).toContain(first)`), and would fail against a hand-built literal.
- **No RNG, no ambient reads, pure and total.** Same as every existing arm.
- **Own-seat-only.** The riichi decision reads only `view.seat`'s own hand/melds/pond, per
  the fair-play doctrine `SeatView` embodies — never another seat's concealed information
  (moot here since `SeatView` cannot expose it anyway).
- **Test convention**: hand-built fixtures via the file's `tileSource()`/`viewOf()` helpers
  for each arm and tie-break key, re-derived through `shanten`/`waits` in-test rather than
  hand-computed; curated (non-`legalActions`-shaped) `offered` arrays are already an
  established pattern for isolating one tie-break from the rest (e.g. "breaks a same-kind
  copies tie by offered order, not copy index").

## 4. Empirical checks performed (via a throwaway vitest scratch file, deleted after)

- `123m456p789s1122z` + drawn `5z`: discarding `5z` is the *unique* shanten-0 discard among
  all 14 candidates; `waits` on the resulting hand is `['1z', '2z']` (non-empty — a genuine,
  winnable shanpon wait). This is a clean "declare" fixture using the *full* realistic
  offered set (no curation needed).
- `1111m234p567p789s` + drawn `9m`: **five** candidates reach shanten 0 — each of the four
  `1m` copies (leaving `111m` + a `9m` tanki wait, `waits === ['9m']`, live) **and** the drawn
  `9m` itself (leaving the original `1111m...` hand, `waits === []`, dead — all four `1m`
  already visible to the hand). All five tie on center-distance (`1` and `9` are symmetric,
  both distance 4 from 5); the existing tie-break's "earliest offered" rule picks the first
  `1m` (hand-order index 0) over the drawn `9m` (offered last) — so the *realistic* full
  offered set never actually reaches the dead-wait candidate. A **curated** offered array
  (isolating just the `9m` discard/riichi pair, following the established curation
  convention) is needed to exercise the dead-wait exception directly, mirroring how the
  existing suite isolates its own copy-variant tie-break case.

## 5. Open questions for Design

- What exactly is the "documented exception"? Candidates considered: (a) decline on
  self-furiten (wait already sits in the seat's own pond) — legal and often still played for
  value in real strategy, so declining reads as an over-restriction, not "simple"; (b)
  decline on a dead wait (`waits(...) === []` — cannot ever complete, by ron *or* tsumo) —
  an unambiguous, objectively-wasted stick, computable from `SeatView` alone, and cleanly
  testable (§4 already found both a declare and a decline fixture). (b) is the strong
  candidate; Design should confirm and reject (a) explicitly.
- Whether/how to widen the seeded sweep (`playPolicy`) to assert riichi actually gets
  declared somewhere in the corpus (non-vacuous, mirroring the claims-non-zero check) and to
  re-verify a folded riichi action's soundness (offered-set membership already covers it
  generically; a per-step tenpai re-derivation would mirror the existing discard-minimality
  oracle).
