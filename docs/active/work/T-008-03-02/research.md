# Research — T-008-03-02 next-hand-new-game-controls

## 1. Ticket text and dependencies

AC: from a won/drawn hand in `just dev`, "next hand" starts the following hand with carried
scores and correct dealer/wind rotation; "new game" resets scores to 25000 with a fresh random
seed (`?seed=` boot pin still reproduces a full game); Drive/SSR tests cover both controls; the
existing new-game header behavior is absorbed without regression.

`depends_on: [T-008-02-01, T-008-03-01]` — both `status: done`, both committed/present:
- T-008-02-01 added `src/core/game.ts` (`GameRecord`, `GameState`, `Player`, `handSeedOf`,
  `foldGame`) — committed to main already (not in `git status`).
- T-008-03-01 added `scoreBreakdownOf`/`ScoreBreakdown` (`settlement.ts`) and
  `src/app/HandEnd.svelte` wired into `Table.svelte` — present in the working tree as
  uncommitted changes (`git status`: `M settlement.ts`, `M settlement.test.ts`, `M Table.svelte`,
  `M app.ssr.test.ts`, `?? HandEnd.svelte`). This ticket builds on that uncommitted state.

## 2. What App.svelte does today

`src/app/App.svelte` holds ALL app state: `seed: number` ($state, from `initialSeed` prop —
either a `?seed=` URL pin or `Math.random()`-drawn) and `actions: HandAction[]` ($state, the
ACTIVE hand's growing action log). `table = $derived(foldRecord({ seed, actions }))` — one hand,
one session. Every tap/claim/pass/win handler does `actions.push(action)`, an element of
`legalActions(table)` selected via `drive.ts`. A `$effect` runs the bot auto-play loop:
`forcedAction(table, offered, PLAYER)` returns the next non-player action or null; a `setTimeout`
(`BOT_DELAY_MS = 250`) pushes it, re-triggering the effect via reactivity.

`newGame()` today: `seed = drawSeed(); actions = []; dismissed = false` — redraws the seed and
starts over. This is the "existing new-game header behavior" the AC says must be absorbed. There
is no `GameRecord`, no persisted score, no second hand — every session is exactly one hand.

`PLAYER: Seat = 0` (`drive.ts`) is imported and passed into every drive call
(`tapDiscard`, `tapClaim`, `settleWindow`, `winChoice`, `promptChoices`, `forcedAction`). All of
drive.ts's exported functions already take an explicit `player: Seat` parameter — none of them
hardcode seat 0 internally. `PLAYER` is App's OWN choice of which seat is "you," not a
drive.ts-imposed constraint.

## 3. Seat vs Player — the identity split game.ts introduces

`record.ts`'s `dealHands` always deals starting from `live[0]` to engine **Seat 0**, and every
wind/yaku computation (`windKindOf(seat) = `${seat+1}z``) treats Seat 0 as "this hand's dealer,"
frozen, per hand. This is a CONTRACT FREEZE — Seat is hand-relative and resets to a fresh
assignment every time a hand is dealt; it carries no cross-hand identity by itself.

`game.ts` adds **Player** (0-3): a persistent identity that survives across hands, distinct from
Seat. `GameState.dealer: Player` is which persistent player currently occupies Seat 0.
`GameState.scores`/`seatWinds` are **Player-indexed** (`scores[player]`, `seatWinds[player]`).
Two PRIVATE (not exported from `game.ts`) helpers do the conversion:
`playerOfSeat(dealer, seat) = (dealer + seat) % 4` and its inverse
`seatOfPlayer(dealer, player) = (player - dealer + 4) % 4`. Neither is exported; `core/index.ts`'s
barrel only re-exports `handSeedOf`/`foldGame`/the three types from `game.ts`.

`foldGame(record: GameRecord): GameState` walks `record.hands` left to right, threading `dealer`
through renchan (dealer repeats on a dealer win, i.e. `state.win.winner === 0`) / rotation
(`nextPlayer`, otherwise — every non-dealer win AND every ryuukyoku), remapping each hand's
`settlementOf` deltas from Seat to Player via whichever `dealer` was current for THAT hand, and
returns `{ scores, dealer, seatWinds, table }` where `table` is the ACTIVE (last) hand's raw
`TableState` (still Seat-indexed, untouched). **Critically: for a record whose last hand has
already ENDED (`phase !== 'playing'`), `foldGame` still applies that hand's settlement into
`scores` before returning** — so `GameState.scores` for an ended active hand IS the correct
post-hand running total, not a "before this hand" snapshot. `handSeedOf(gameSeed, handIndex)` is
the sole, frozen, collision-free derivation of each hand's wall seed — no hand stores its own
seed. `foldGame` throws `RangeError` if `record.hands` is empty or a non-last hand is unended.

This machinery (foldGame's rotation/scores/seed-derivation correctness) is ALREADY fully tested
in `game.test.ts` and `game.dynamics.test.ts` (T-008-02-01/T-008-02-02, both done/committed) —
mined bot-vs-bot fixtures pin renchan, rotation, and multi-hand seed determinism. **This ticket
does not need to re-prove foldGame's correctness — only that App.svelte calls it correctly.**

## 4. Table.svelte / HandEnd.svelte — current seat assumptions

`Table.svelte`'s `SEATS` array is a literal 4-tuple (`{wind, pond, area, you}`), iterated with
loop index `i` used DIRECTLY as the engine Seat index into every `table.*[i]` read
(`table.ponds[i]`, `table.melds[i]`, `table.turn === i`). `seat.you` is hardcoded `true` only for
index 0; the player's own hand (`table.hands[0]`, hardcoded) and drawn-tile block
(`table.turn === 0`, hardcoded) both assume the human IS engine Seat 0. This is exactly correct
in the current single-hand-only world (Seat 0 is always the human, always the dealer, forever,
because there is only ever one hand).

`HandEnd.svelte` (uncommitted, T-008-03-01) computes `breakdown = scoreBreakdownOf(table)` and
renders `breakdown.winner`/`breakdown.from` (engine Seat) and `breakdown.scores` (Seat-indexed,
`ScoreBreakdown`'s own field — see §5) through a local `WIND = ['East','South','West','North']`
lookup indexed by Seat. `breakdown.winner === 0` is the literal "(you)" test.

## 5. `scoreBreakdownOf`'s `scores` field is hand-only, by design, flagged for this ticket

`settlement.ts`'s `ScoreBreakdown.scores` is `deltas` applied to a LOCAL
`STARTING_SCORE_DISPLAY = 25000` constant (duplicated from `game.ts`'s `STARTING_SCORE` to avoid
an import cycle — `game.ts` already imports `settlementOf` from `settlement.ts`). T-008-03-01's
own `review.md` (§4) explicitly says: *"scores are single-hand, not a persisted running total...
Whoever wires App.svelte to a persistent GameRecord next will need to decide whether HandEnd
should then read a running total from GameState instead of always starting fresh at 25000 — this
ticket does not block that, but the field will need a second look then."* That "second look" is
this ticket. `settlement.ts` is NOT touched by this research — the fix is additive at the
`App.svelte`/`HandEnd.svelte` layer (§7 of design.md), not inside `settlement.ts` itself.

## 6. Test files and conventions touched by this surface

- `src/app/app.ssr.test.ts` — SSR-only (`svelte/server`'s `render`; `$effect` never runs in SSR,
  per App.svelte's own comment). ONE describe block renders `App` with a real `initialSeed` and
  compares against an independently-built `foldRecord({ seed: BOOT_SEED, actions: [] })` fixture
  (line ~57-58) — every OTHER describe block renders `Table` directly against hand-authored
  `foldRecord` fixtures, entirely bypassing App's internal seed handling.
- `src/app/drive.test.ts`, `src/app/table.tap.svelte.test.ts` — test `drive.ts`'s pure functions
  and `Table.svelte`'s tap wiring directly, never through `App`, using their own `PLAYER`/seat-0
  convention. Neither imports or mounts `App`.
- `table.tap.svelte.test.ts` is "the repo's one client-mount suite" (its own header comment) —
  `mount`/`flushSync` from `svelte`, jsdom via vitest's `dom` project (files matching
  `*.svelte.test.ts`). No existing test drives `App`'s `$effect`-based bot loop through a mount —
  that loop has never been exercised outside `just dev` itself.
- Every mined-seed fixture in this codebase (`game.test.ts`, `win.test.ts`, etc.) was found by a
  **throwaway, uncommitted script** run offline against the real bots — the stated, repeated
  convention (`game.test.ts`'s own header: "game seeds MINED offline... not committed").

## 7. Constraints carried into Design

- `foldGame` requires `record.hands.length > 0` always — App's initial state must be
  `hands: [[]]`, never `[]`.
- Changing App's per-hand seed from raw `seed` to `handSeedOf(gameSeed, handIndex)` is a real,
  AC-sanctioned behavior change (the AC only requires the pin still reproduces a full game
  deterministically, not bit-identical dealing to pre-ticket behavior) — it invalidates exactly
  ONE existing SSR fixture (§6).
- `GameState.scores`/`seatWinds` are Player-indexed; every other seat-facing datum in the app
  (`table.*`, `breakdown.winner`/`.from`/`.tenpai`, `WIND` lookup) is Seat-indexed. Any carried
  score display must be reindexed from Player-space to THIS hand's Seat-space
  (`scores[playerOfSeat(dealer, seat)]`) or it mislabels money once the dealer ever rotates away
  from Player 0 — even if the interactive "you" seat itself does not move (see design.md).
