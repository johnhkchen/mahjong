# T-008-02-01 — game-record-and-continuation-fold — Research

What exists, where, and how it connects. Descriptive only; the design phase decides.

## 1. The ticket

Extend the record contract one level up: a `GameRecord` is starting scores (25000 each)
plus an ordered list of hand records; seat scores are derived by folding hand outcomes
through the settlement function — fold-only authority, same as the hand level. Next hand
deals from a derived per-hand seed (documented derivation from the game seed + hand
index). The dealer repeats on a dealer win (renchan) and rotates otherwise, with seat
winds following the rotation (seat-wind yakuhai must track it; round wind held at East).
`depends_on: [T-008-01-03]` — `done`, consumed directly (`settlementOf`).

## 2. What already exists to build on

**`src/core/record.ts`** — `HandRecord = { seed: number; actions: readonly HandAction[] }`,
`foldRecord(record): TableState`. Two facts matter enormously for this ticket:

- **Engine `Seat` is already dealer-relative, not player-absolute.** `dealHands` always
  deals starting from `live[0]` to seat 0 first (`deal.ts`'s frozen 4-4-4-1 procedure),
  and `windKindOf(seat) = `${seat + 1}z`` (both `record.ts` and `settlement.ts` carry a
  duplicated private copy) unconditionally maps engine seat 0 → East, 1 → South, 2 → West,
  3 → North. So **within one hand's fold, "whoever plays engine seat 0" already gets East
  wind and deals first** — nothing about `foldRecord` needs to change for seat-wind
  yakuhai to score correctly after a rotation. What's missing is purely the layer ABOVE:
  which *persistent player* occupies engine seat 0 for hand *h*, given hand *h-1*'s
  outcome.
- **`ROUND_WIND` is a private frozen constant, `'1z'`, in both `record.ts` and
  `settlement.ts`**, each carrying the identical comment: "Records are single hands —
  round rotation is match structure the engine does not hold... **the match epic threads
  the true round wind in as a fold input when it exists**." This ticket is scoped to hold
  round wind at East throughout (the ticket's own words), so it does NOT thread a round
  wind parameter into `foldRecord` — it is deliberately not "the match epic" the comment
  anticipates (that is a hanchan/round-transition ticket, out of scope here). No change to
  `record.ts` or `settlement.ts` is implied by this ticket.
- `TableState.win: { by, winner: Seat, tile, yaku, ... } | null` and `TableState.phase:
  'playing' | 'ryuukyoku' | 'agari'` are exactly what's needed to detect a dealer win:
  `phase === 'agari' && win.winner === 0` (engine seat 0 is always the dealer of that
  hand, per above).

**`src/core/settlement.ts`** — `settlementOf(state: TableState): SeatDeltas` where
`SeatDeltas = readonly [number, number, number, number]`, indexed by engine `Seat`
(dealer-relative), always summing to zero. Throws `RangeError` if `state.phase ===
'playing'` (unended hand). This is the per-hand pricing this ticket folds across hands —
untouched, called as-is.

**`src/core/deal.ts`** — `Seat = 0 | 1 | 2 | 3`, `SEAT_COUNT = 4`,
`STARTING_HAND_SIZE = 13`, `DEAL_SIZE = SEAT_COUNT * STARTING_HAND_SIZE`. These are the
"Taiwan guardrail" constants the ticket's AC calls out by name ("Hand-size/set-count
constants stay named") — a future Taiwan 16-tile variant changes `STARTING_HAND_SIZE`
to 16 and reshapes the wall; this ticket must reuse `SEAT_COUNT` (not a literal `4`) for
every seat-indexed loop/modulo it introduces, matching every existing module's practice
(`legal.ts`, `record.ts` both do `(x + 1) % SEAT_COUNT`).

**`src/core/wall.ts` / `rng.ts`** — `buildWall(seed)` derives the whole 136-tile order
from one `number` seed via `createRng` (mulberry32) + Fisher-Yates. The CONTRACT FREEZE
convention (documented in `rng.ts` and repeated in `wall.ts`, `deal.ts`, `record.ts`):
seed → wall order is permanently fixed, because a hand's record IS its seed + actions.
This ticket's per-hand seed derivation must respect the same spirit: a pure, frozen,
documented function of `(gameSeed, handIndex)`, since a GAME's record is now the
authoritative replay unit and its hands must reproduce identically forever.

**No existing match/round/game-level state anywhere in the engine.** `grep` across
`src/` for `GameRecord`, `renchan`, `honba`, `hanchan`, `tonpuusen` returns nothing outside
doc comments and vision/charter prose. This is genuinely new ground — no code to extend,
only conventions to follow.

**`src/core/yaku.ts` / `yakuman.ts`** — `WindKind = '1z' | '2z' | '3z' | '4z'`. `WinContext`
and `Win` both carry `seatWind`/`roundWind: WindKind`, supplied by the fold (`record.ts`'s
`applyWinTail`), never derived by `yaku.ts` itself. Confirms winds are entirely an
upstream-fold responsibility — consistent with the "engine seat already IS dealer-relative"
finding above.

## 3. Domain facts this ticket must encode (external, not derived from any file)

- **Starting scores**: 25000 per seat, the standard riichi convention (matches the
  ticket's Context verbatim — "starting scores (25000 each)").
- **Renchan** (dealer repeat): the dealer keeps dealing when the dealer wins (tsumo or
  ron) the hand just played. The ticket's AC explicitly narrows this ticket's scope: only
  a **dealer win** causes renchan; "rotates otherwise" — meaning a non-dealer win AND a
  ryuukyoku (exhaustive draw) both rotate the dealer in this ticket's model. (Real riichi
  rules also grant renchan on dealer-tenpai ryuukyoku; the ticket's AC text does not ask
  for that nuance, and `settlement.ts`'s own header already documents that honba/riichi
  sticks are out of scope for the engine — a smaller, honba-free model is consistent with
  that existing scope cut.)
- **Seat wind rotation**: when the dealer advances by one player, every player's wind
  advances by one step too (the player who was South becomes East, etc.) — this falls out
  for free once "current dealer" is tracked as a persistent player identity and winds are
  computed relative to it (see §2's engine-seat finding).
- **Round wind**: stays East (`'1z'`) for the ticket's scope — no East→South round
  transition logic. (Consistent with a tonpuusen, or the East half of a hanchan; a later
  ticket handles round transition explicitly, per the frozen comment in §2.)
- **Per-hand seed derivation**: needs to be a pure, deterministic, and — per the AC —
  **collision-free across hand indices** function of `(gameSeed, handIndex)`. No existing
  precedent for combining two integers into a derived seed exists in the codebase; `rng.ts`
  only shows single-seed → stream derivation (mulberry32) and odd-multiplier mixing
  constants (`0x6d2b79f5`, `Math.imul(t ^ (t >>> 15), t | 1)`) as prior art for "how this
  codebase mixes numbers deterministically."

## 4. Constraints carried over from the architecture docs

- `src/core/` stays framework-agnostic — no DOM/Svelte imports (CLAUDE.md, architecture.md
  §6). A game-level module is still pure engine code, same tier as `record.ts`.
- "A hand is its record... table state is always derived by folding" (architecture.md §1)
  — the ticket's own Context restates this one level up ("fold-only authority, same as the
  hand level"): `GameRecord` must be data only (seed + hand action logs), with scores/
  dealer/winds/table-state all DERIVED by a fold function, never stored redundantly. This
  is the same "no second authority" discipline `record.ts`'s header applies repeatedly
  (draw records no tile, tsumo records no tile, ron records no winner) — applied here to
  mean per-hand seeds and dealer identity must never be stored fields alongside data they
  can be recomputed from.
- Barrel export convention: every `src/core/*.ts` module is re-exported with one line
  from `src/core/index.ts`, appended after the module it depends on most directly
  (`settlement.ts` was appended after `han.ts`; a new game-level module depends on both
  `record.ts` and `settlement.ts`, so it belongs after `settlement.ts`, last in the file).

## 5. Testing conventions carried forward

`settlement.test.ts` (T-008-01-03) sets the house style this ticket should match:
hand-derive every expected number in a comment before the assertion (never from a first
run); build fixtures at the natural input level of the function under test (there,
`TableState`-shaped objects; here, likely `GameRecord`-shaped objects, i.e. real per-hand
`HandAction[]` logs folded through the real `foldRecord`/`settlementOf`, OR a lighter
fixture if constructing real winning `HandRecord`s per test is impractical — Design must
decide). `fu.test.ts`/`han.test.ts`/`settlement.test.ts` all avoid reverse-engineering
expected numbers from the code itself.

## 6. Open questions for Design

- How does a `GameRecord`'s per-hand entry avoid storing a seed that could disagree with
  the derived one (the "no second authority" principle from §4)?
- What is the natural "player identity" type — reuse `Seat` (same domain, 0-3) under a new
  name, or something else? How is the mapping between a hand's engine-relative `Seat` and
  the persistent player identity expressed and computed?
- What does "the active hand's TableState" mean when the list's last hand might still be
  mid-play (`phase: 'playing'`) versus already ended? Do earlier list entries have to be
  fully ended for the fold to be well-formed, and if not, is that corruption (throw) or
  tolerated?
- Exact per-hand seed derivation formula — needs to be provably collision-free (not just
  probabilistically unlikely to collide), documented, and frozen like every other seed
  convention in this codebase.
