# T-004-01-01 — chi-pon-claim-fold-semantics — Design

Decisions with rationale, grounded in research.md. Five decisions carry the ticket:
action encoding, claim-window tracking, the post-claim discard discriminant, the
meld/pond representation, and module placement — then the test strategy.

## D1 — Action encoding: explicit claimed tile + explicit consumed tiles

```ts
| { type: 'chi'; seat: Seat; tile: TileId; uses: readonly [TileId, TileId] }
| { type: 'pon'; seat: Seat; tile: TileId; uses: readonly [TileId, TileId] }
```

**Options considered:**

- **(a) Record `tile` and `uses` (chosen).** `tile` is the claimed discard, `uses` the
  two physical hand tiles exposed. `tile` is derivable from the claim window, so it is
  *deliberate redundancy* — exactly the frozen `seat`-tag precedent ("a wrong-seat
  action in a log is corruption, and the fold throws loudly"). The AC's wrong-tile
  claim case is only expressible if the action names the tile it believes it claims.
- **(b) Record `uses` only, derive `tile`.** Slimmer, but a corrupted log that meant to
  claim a different discard folds silently into whatever is claimable — the exact
  silent-fold failure the vocabulary's conventions exist to prevent. Rejected.
- **(c) Record kinds, not ids.** Ambiguous about which physical copies leave the hand —
  copies are distinct ids and red-five distinctions arrive later. Violates the
  `discard.tile`-is-physical precedent. Rejected.

Two types, not one parameterized `claim` type: matches the flat vocabulary style
(draw/discard are separate members), and T-004-01-02's three kan forms would strain a
single shape anyway. `uses` order is preserved as recorded (the log is the authority;
sorting is presentation).

## D2 — Claim window: a `claimable` field, set by discard, cleared by draw or claim

```ts
claimable: { readonly seat: Seat; readonly tile: TileId } | null
```

The fold currently forgets a discard as it lands (research.md); *some* new state must
say "this discard is still fresh". Options:

- **(a) `claimable: {seat, tile} | null` (chosen).** Set on every discard while the
  hand stays `playing`; cleared by the next draw (the staleness rule: a draw closes
  the window) and by a successful claim (the tile left the pond's claimable status).
  Both fields earn their place: `tile` is what a claim must match, `seat` is what the
  chi left-neighbor rule and the pond mark are defined against. Neither is derivable —
  "last seat whose pond grew" is exactly the information the fold discards today.
- **(b) Derive from the last action during the fold.** applyAction is a per-action step
  over `(state, action)`; threading "previous action" beside the state re-derives (a)
  with more machinery and leaves TableState — the app's and T-004-01-03's input —
  unable to see the window at all. legalActions is a function of TableState *only*, so
  the window must be a state fact. Rejected.

Staleness then falls out: a claim with `claimable === null` (nothing discarded yet, or
the next seat already drew) throws — the AC's stale-discard case. The final discard is
never claimable for free: the wall-emptying discard flips `phase` to `'ryuukyoku'` in
the same step, and the ended-hand guard already rejects everything — matching the
riichi rule that the last discard cannot be called for chi/pon.

## D3 — Post-claim "must discard": an explicit `mustDiscard` boolean

After a claim the caller owes a discard *without drawing* — a state shape the fold
cannot currently express: `(drawn === null, claimable === null)` already means "awaiting
a draw" at the start of a hand. Options:

- **(a) `mustDiscard: boolean` (chosen).** True exactly from a claim until the caller's
  ensuing discard. The discard step branches on it (hand tiles only — there is no drawn
  tile); the draw step rejects when it is set (a caller cannot draw). One bit, named
  for the one situation it encodes; `drawn` keeps covering the post-draw discard
  obligation as today.
- **(b) Infer from arithmetic: `hands[turn].length + 3·melds[turn].length` is 13 when a
  draw is owed, 14 when a discard is owed.** True invariant, zero new state — but it
  buries the turn cycle's central discriminant in modular arithmetic that every reader
  (and T-004-01-03's enumeration, and the app's prompt logic) must re-derive. The
  codebase's style is loud explicitness (deliberately redundant seat tags). Rejected.
- **(c) A full `awaiting: 'draw' | 'discard'` discriminant.** Subsumes (a) but overlaps
  `drawn !== null`, creating a second authority over the post-draw case that every
  mutation must keep synchronized. The boolean adds the *missing* bit only. Rejected.

## D4 — Melds and the pond mark: pond keeps the full discard history; the meld's
`claimed`/`from` fields ARE the mark

```ts
interface Meld {
  readonly type: 'chi' | 'pon'
  readonly claimed: TileId            // the claimed discard — stays counted in ponds[from]
  readonly from: Seat                 // the discarder it was claimed from
  readonly own: readonly [TileId, TileId]  // the caller's tiles exposed from hand, recorded order
}
// TableState gains: melds: readonly [Meld[], Meld[], Meld[], Meld[]]
```

The load-bearing choice is where the claimed tile *counts* in the 136-tile partition:

- **(a) Claimed tile stays in `ponds[from]`; melds contribute only `own` (chosen).**
  The pond remains the *complete discard history* in discard order — the property the
  TableState docs call out as the pond's meaning ("future defense reads depend on it").
  Riichi's own rules want this: furiten and safe-tile reasoning treat a claimed-away
  tile as still discarded by that seat. The AC's "claimed tile is *marked* in its
  discarder's pond" reads literally: the tile is still there, and the pair
  `(from, claimed)` on the caller's meld marks it — a join the UI ticket (T-004-02-02
  "marks the claimed tile in the discarder's pond") and tests both do in one scan. The
  partition extends cleanly: every id lives in exactly one of **hands / melds.own /
  ponds / drawn / live / dead**, and T-004-01-02's formula
  `hands + melds + ponds + drawn + live + dead == 136` holds with melds contributing
  their `own` tiles.
- **(b) Move the claimed tile out of the pond into the meld.** Physically faithful to a
  table (the tile sits rotated in the meld area), but the pond stops being the discard
  history — furiten/defense reads would have to reassemble it from melds — and "marked
  in its discarder's pond" becomes "absent from its discarder's pond", a stretch. Every
  existing consumer iterating ponds for history would silently under-read. Rejected.
- **(c) Change the pond element type to `{tile, claimedBy}`.** Honest, but reshapes a
  field every consumer touches (Table.svelte's `{#each table.ponds[i] as id (id)}`,
  every pond assertion in three test files) for information the meld already carries.
  TableState may grow fields freely; *reshaping* existing ones spends compatibility for
  nothing. Rejected.

`claimed` is kept even though a future ankan has no claimed tile — Meld is part of the
derived view, not the frozen record contract, so T-004-01-02 may widen the shape when
the kan forms demand it (noted there as a seam).

## D5 — Placement: extend record.ts; no new module

Claim validation and application are step semantics — record.ts is the step's single
authority, and legal.ts is explicitly deferred to T-004-01-03. A separate `melds.ts`
with shape predicates (chi-run check, pon-kind check) would serve T-004-01-03's
enumeration too, but extracting before the second consumer exists is speculation; the
predicates stay module-local functions in record.ts, extractable later without moving
any contract. record.ts grows ~120 lines — well within one legible module.

## Step semantics (the contract, precisely)

**chi** at index i throws RangeError naming i unless: phase is `playing` (existing
guard); `claimable !== null` (else stale/none); `seat === (claimable.seat + 1) % 4`
(left-neighbor rule, phrased from the caller: chi claims only from the seat before you
in rotation); `tile === claimable.tile`; `uses` are two *distinct* ids both present in
`hands[seat]`; and `kindOf(tile)`, `kindOf(uses[0])`, `kindOf(uses[1])` are three
consecutive ranks of one numbered suit (honors fail rank-wise). Guard order is fixed:
window → seat → tile → held/distinct → shape, so each test provokes one named guard.

**pon** likewise, with: `seat !== claimable.seat` replacing the neighbor rule (any
other seat may pon), and the shape check `kindOf(uses[0]) === kindOf(uses[1]) ===
kindOf(tile)`.

**On success (both):** splice `uses` out of the caller's hand; push
`{type, claimed: tile, from: claimable.seat, own: uses}` onto `melds[seat]`;
`turn = seat` (the jump — seats between discarder and caller never draw);
`claimable = null`; `mustDiscard = true`; `drawn` stays null.

**discard** grows one arm: when `mustDiscard`, the tile must be in the hand (there is
no drawn tile to tsumogiri), leaves for the pond, and `mustDiscard` clears. Every
discard that keeps the hand `playing` now also sets `claimable = {seat, tile}` — both
the normal and post-claim arms.

**draw** grows two touches: it throws when `mustDiscard` is set (a caller cannot
draw), and it sets `claimable = null` (the window closes — the staleness rule).

**Pon-over-chi determinism** needs no mechanism: precedence is resolved at record time;
the log contains the single claim that happened, and the fold replays exactly it. The
test obligation is to show a state offering both, where each logged resolution folds
deterministically (same record → same state) and distinctly.

## Test strategy (record.test.ts, per the AC)

House style holds: expectations wall-derived or hand-derived from frozen seed-1 facts,
never read back from the fold under test. Seed 1 already yields a minimal chi — East's
first draw is `100` (8s); on its tsumogiri South holds `98` (7s) and `106` (9s) — and
South holds the `81`/`83` (3s) pair against East's hand tile `82` (3s) for a pon. A
scratchpad scan at implement time locates equally small frozen scenarios for the
remaining cases (pon by a non-adjacent seat proving the turn jump and skipped draws;
a state where chi and pon are simultaneously available), embedded as literals with
derivation comments per the "never regenerate" precedent. New example + small property
tests cover: meld exposure and hand shrinkage, pond mark join, turn jump + forced
discard, post-claim tedashi, conservation including `melds.own`, double-fold
determinism over claim-bearing records, and an illegal-claim matrix through the
existing `expectThrows` helper (wrong tile, wrong seat chi/pon, discarder pon, stale
after draw, claim at hand start, unheld/duplicate `uses`, bad shapes, claim after
ryuukyoku). Existing suites stay green: tsumogiri records never form melds, dynamics
generates only from legalActions (which this ticket does not extend), and the two
full-TableState literals just gain `melds: [[],[],[],[]]`, `claimable`, `mustDiscard`.
