# T-006-03-01 — discard-policy — Research

Descriptive map of what exists and where this ticket's work lands. No proposals.

## 1. The ticket, verbatim

The deterministic pure discard/draw policy: (SeatView, offered legal actions) →
chosen action — pick the shanten-minimizing discard by a documented tie-break, and
always take a legal tsumo. AC: a pure policy function chooses a discard that is an
element of the offered set and does not raise the seat's shanten; given an offered
tsumo it always returns it; no RNG, and repeated calls on the same SeatView return
the same action. Depends on T-006-01-01 (seatview-projection, `phase: done`) and
T-006-02-02 (chiitoi-kokushi-min-combinator, `phase: done`).

Dependency status detail: the `shanten` combinator from T-006-02-02 exists in the
working tree (`src/core/shanten.ts`) but is **not yet committed** — the working
tree carries that ticket's finished diff (+67 lines: `shanten`, `chiitoiShanten`,
`kokushiShanten`). Lisa serializes commits across threads; this ticket builds on
the working-tree state and must not touch `shanten.ts` or `shanten.test.ts`.

## 2. `src/core/seatview.ts` — the policy's input type (T-006-01-01)

`SeatView` is the read-only projection of a folded `TableState` down to one seat's
legitimate view; `seatView(state, seat)` builds it. Fair play is **structural**:
the interface has no field that can hold hidden information, and the module header
states the doctrine explicitly — "Bots, hints, defense reads, and attract mode are
all meant to take THIS, never TableState." This ticket's policy is the first such
bot-side consumer. Fields the policy can read:

- `seat: Seat` — whose view; offered actions carry `seat` too, so the policy can
  identify its own actions.
- `hand: readonly TileId[]` — own concealed hand, **draw order, never sorted**.
- `drawn: TileId | null` — own drawn tile; null when this seat holds no draw.
- `melds: readonly [Meld[], Meld[], Meld[], Meld[]]` — all four seats' melds;
  `melds[seat]` is what shanten reads (arity only).
- `ponds`, `doraIndicators`, `doras`, `wallCount`, `turn`, `phase`,
  `claimable`, `mustDiscard`, `win` — available but not obviously needed for a
  shanten-minimizing discard.

Purity contract already documented there: pure and total, no throws, no RNG,
arrays fresh per projection, same state+seat → deep-equal view.

## 3. `src/core/legal.ts` — the offered set

`legalActions(state): HandAction[]` enumerates exactly what the fold accepts, in a
**deterministic order that is part of the contract** ("bots and generators may
sample by index"). The five state classes, as they concern this ticket:

- **`drawn !== null`** (post-draw, own turn): the 14 discards — 13 hand tiles in
  hand order then the drawn tile last — then the tsumo offer if the drawn tile
  completes a yaku-bearing hand, then ankan offers, then shouminkan offers. All
  actions in this class belong to the turn seat.
- **`mustDiscard`** (a chi/pon just folded): the caller's hand discards in hand
  order, nothing else. Hand arity here is 14 − 3·melds (the claim consumed two
  hand tiles and added a meld; a discard is owed).
- **`drawn === null`** (pre-draw): the turn seat's single `draw` FIRST, then, if a
  claim window is open, ron offers and claim offers **for other seats** — and
  possibly a ron for the turn seat itself (`ronOffers` scans all three non-
  discarder seats, which includes the new turn seat).
- **`ryuukyoku`**: only houtei ron offers (usually empty). **`agari`**: nothing.

Discard actions are `{ type: 'discard', seat, tile: TileId }`; tsumo is
`{ type: 'tsumo', seat }`; draw is `{ type: 'draw', seat }` (record.ts:64-92).
`legalActions` returns fresh action literals per call — same state → same array.

## 4. `src/core/shanten.ts` — the datum the policy minimizes

`shanten(concealed: readonly TileKind[], melds: readonly Meld[]): number` — the
min-of-three combinator (standard, chiitoitsu, kokushi), whose own doc comment
names this ticket: "the single shanten datum the discard policy minimizes."
Contract facts that shape the policy:

- **Kind-level**: takes `TileKind[]`, not `TileId[]` — the policy maps ids
  through `kindOf` first.
- **Arity-strict**: accepts exactly 13 − 3·melds (waiting) or 14 − 3·melds
  (drawn) concealed tiles; anything else throws `RangeError` (caller corruption,
  not "far from tenpai"). Melds > 4 also throws.
- **Melds arity-only**: each call discounts one required set; content ignored.
- Returns −1 (complete) through 8; pure, inputs never mutated.

Cost: the standard-form backtracker is exponential in the worst case but heavily
pruned; existing suites call it thousands of times per run without issue. A
policy decision is ≤ 14 shanten calls.

## 5. Arity arithmetic — offered discards land on shanten's contract

- Post-draw: hand holds 13 − 3·melds, plus drawn → removing any one offered
  discard leaves 13 − 3·melds ✓ (waiting arity).
- mustDiscard: hand holds 14 − 3·melds (13 − 3·(melds−1) − 2), no drawn →
  removing one leaves 13 − 3·melds ✓.

So in both discard-offering classes, "hand ∪ drawn minus the discarded tile"
is always a legal `shanten` query with `view.melds[seat]`. The pre-draw hand
(13 − 3·melds, no drawn) is also a legal query — the "does not raise" baseline.
Since the drawn tile is always among the offered discards (tsumogiri restores the
pre-draw hand exactly), the minimum over offered discards is ≤ pre-draw shanten.

## 6. `src/core/tiles.ts` — tie-break vocabulary

`kindOf(id)`, `rankOf(kind): Rank | null` (null for honors), `isHonor`,
`isTerminal`, `isSimple`, `kindIndexOf` — everything a documented tie-break could
be phrased in. TileIds are unique integers (kind × 4 + copy), so removing an
offered discard's tile from the hand multiset is an exact id match.

## 7. Downstream consumers — what this policy must serve

- **T-006-03-02 (call-policy, depends on this)**: "the call branch of the
  policy" — chi/pon/kan acceptance, pass, always-ron. The policy module grows
  extend-only; claim windows and ron handling are explicitly NOT this ticket.
- **T-006-03-03 (drive-seam-wiring)**: `src/app/drive.ts` currently has a
  `forcedAction` with a deliberate **tsumogiri placeholder** ("a bot's kan offers
  lose to tsumogiri below", "A real bot later replaces" it) and bot auto-pass on
  claims. It will route non-player seats to the policy. The drive holds
  TableState, computes `legalActions`, and projects `seatView` — so the policy
  signature (view, offered) → action matches what the seam can supply.
- **T-006-03-04 (determinism-termination-harness)**: replays a full four-bot
  game byte-identically from a seed — the AC's "no RNG / same view → same
  action" is what makes that possible.

## 8. Test infrastructure and conventions

- **vitest + fast-check** (devDependencies; `just test` runs vitest over core).
- **purity.test.ts gate**: runtime core modules may import only `./` siblings;
  test files additionally only `vitest|fast-check|node:`. A new `policy.ts` and
  `policy.test.ts` are automatically covered by the glob.
- **dynamics.test.ts precedent**: seeded whole-game drivers built test-locally
  (`playRecord(seed, choices)`, `playGreedy(seed)`, `playWinEager(seed)`) that
  advance only by refolding records through `foldRecord` and choose from
  `legalActions` — "the generators are test-local by design: bots ... are a
  later epic with their own shape." This ticket IS that later shape, but the
  test-local driver pattern (fold a growing record, evaluate at every prefix)
  is directly reusable for property-testing the policy over real states.
  `ACTION_BOUND = 172` converts non-termination into a throw.
- **seatview.test.ts / seatview.fairplay.test.ts**: build views via
  `seatView(foldRecord(record), seat)` from constructed records; fairplay
  property permutes hidden pools. Constructing precise hands via records is
  laborious; SeatView is a plain interface, so tests may also build view
  literals directly.
- Error-posture precedent: `RangeError` naming the violated contract
  (shanten/waits/standardShanten all do this).

## 9. `src/core/index.ts` — the barrel

Core's public face; app code imports only from here. A new module must be added
as an `export * from './policy'` line. No policy/bot module exists anywhere in
`src/core/` today (grep confirms: "policy|bot" hits only comments in legal.ts,
drive.ts's placeholder language, and test files).

## 10. Constraints and open questions for Design

- **Tie-break choice** — the ticket mandates "a documented tie-break" but not
  which: offered-order-first, kind-index, center-distance (keep middle tiles),
  or ukeire (count of advancing tiles). Competence vs. scope tension; the
  teaching layer (hints, post-hand review) will later want the tie-break to be
  *explainable*.
- **Function scope** — post-draw and mustDiscard discards plus tsumo are clearly
  in; the pre-draw `draw` action ("discard/draw policy" in the ticket context)
  needs a decision; claim windows and rons are T-006-03-02's.
- **Behavior at non-own-turn offered sets** — throw (the RangeError precedent)
  vs. a null return; affects how T-006-03-02/03 compose.
- **Module/function naming** — one growing `policy.ts` face vs. per-branch
  functions; T-006-03-02 will extend whatever lands here.
- **Kan offers post-draw** — this policy sees ankan/shouminkan offers in its
  input and must deterministically not choose them (call branch is 03-02).
- **Concurrent working tree** — shanten.ts's combinator is uncommitted
  (T-006-02-02/03 threads); this ticket must stage only its own files.
