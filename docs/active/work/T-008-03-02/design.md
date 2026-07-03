# Design — T-008-03-02 next-hand-new-game-controls

## Decision 1 — App's state becomes `{ gameSeed, hands: HandAction[][] }`, one array not two

**Chosen**: replace `seed`/`actions` with `let gameSeed = $state(initialSeed)` and
`let hands = $state<HandAction[][]>([[]])` — the ACTIVE hand is always `hands[hands.length - 1]`.
`const record = $derived<GameRecord>({ seed: gameSeed, hands })`,
`const game = $derived(foldGame(record))`, `const table = $derived(game.table)`. Every existing
`actions.push(action)` call site becomes `hands[hands.length - 1].push(action)`.

**Why one array, not `priorHands` + `actions` as two `$state` variables**: a `GameRecord` IS
`{ seed, hands }` — mirroring that shape directly means `record` is a trivial object literal, no
`[...priorHands, actions]` spread recomputed on every derive. "next hand" becomes `hands.push([])`
and "new game" becomes `hands = [[]]` — both single, obviously-correct statements. Svelte 5's
`$state` proxies arrays deeply, so `hands[hands.length-1].push(x)` on a nested array still
triggers the same reactivity the flat `actions.push(x)` did — verified structurally: `$derived`
tracking follows property reads through proxied nested objects (the same mechanism that already
lets `table = $derived(foldRecord({ seed, actions }))` react to `actions.push` today).

**Rejected: keep `actions` as its own `$state` array, add a separate `priorHands: HandAction[][]`
$state**. Two sources of truth for one `GameRecord` — every derive would need to reassemble
`{ seed: gameSeed, hands: [...priorHands, actions] }`, and "next hand" would need
`priorHands = [...priorHands, actions]; actions = []` (two assignments, ordering matters). No
correctness win over the one-array model, strictly more moving parts.

## Decision 2 — the interactive "you" seat stays engine Seat 0; it does NOT follow a rotating
persistent Player identity around the table

**Chosen**: `Table.svelte`, `drive.ts`, `ClaimPrompt.svelte` are UNCHANGED. App keeps passing the
existing `PLAYER: Seat = 0` constant into every drive call, exactly as today. The human always
plays whichever hand is CURRENTLY dealt at engine Seat 0 — i.e., always the current hand's dealer
seat, every hand, for the whole session.

**Why**: making the human a persistent `Player` identity that FOLLOWS the rotating dealer around
the table (so they sometimes play South/West/North, non-dealer) would additionally require: (a)
`Table.svelte`'s per-seat loop remapped from engine-Seat-indexed to Player/visual-slot-indexed
reads (`table.ponds[i]` → `table.ponds[seatOfPlayer(dealer, slot)]` for every one of `ponds`,
`melds`, `turn`, `hands`, `drawn`, plus the claimed-meld `from` label), (b) `drive.ts` calls fed a
per-hand-computed `humanSeat = seatOfPlayer(game.dealer, HUMAN_PLAYER)` instead of the constant,
and (c) `HandEnd.svelte`'s winner/tenpai/wind labels remapped through the same conversion. That is
a real UI-seat-rotation feature (four components touched, a wide swath of new
per-seat-remapping logic to get right in the one place a bug is invisible until a specific dealer
rotation happens), not "controls" — and neither dependency ticket (T-008-02-01, T-008-03-01)
touched `drive.ts`/`Table.svelte`'s seat semantics, meaning it was never staged as this ticket's
job. The ticket context text is explicit about what MUST change: *"'next hand'... deals fresh from
the derived seed with scores carried and dealer/wind rotated **by the game fold**"* — the rotation
is a property `foldGame` produces (already built, already tested — research.md §3), not a
UI-camera feature this ticket must also build. "The view never invents game state" (ticket
context, last line) cuts the same way: this ticket's job is reading `foldGame`'s output correctly,
not deciding how a rotating camera should look.

**Consequence, named explicitly**: under this design, the human is Seat 0 (dealer) of literally
every hand dealt in a session — `game.dealer` (the Player abstraction) still rotates correctly
hand to hand as `foldGame` computes it, but since the interactive seat is pinned to Seat 0 by
construction, the human's own `Player` identity is not fixed — it is definitionally whichever
Player `game.dealer` says occupies Seat 0 this hand. The three bot seats are fully
policy-interchangeable (stateless, no persistent trait), so this is invisible for them; it is only
a real teaching gap for the human never experiencing a genuine non-dealer hand. Flagged in
review.md as a follow-up ticket candidate, not resolved here.

**Rejected: human-anchored rotating view** (the full remap in (a)-(c) above) — correct
long-term, explicitly deferred as out of this ticket's allocatable scope (see Rejected rationale
above); would roughly double this ticket's touched-file count and test-fixture churn for a
"controls" ticket.

## Decision 3 — carried scores ARE reindexed from Player-space to this hand's Seat-space before
display, even though the interactive seat itself doesn't move

**Chosen**: `drive.ts` gains one new exported pure function,
`seatScoresOf(scores, dealer) => [0,1,2,3].map(seat => scores[(dealer + seat) % 4])`, and
`App.svelte` calls `seatScores = $derived(seatScoresOf(game.scores, game.dealer))`. Decision 2
keeps the human pinned at Seat 0, but the OTHER three seats' occupants (Players) still rotate
among themselves every hand (research.md §3), so `game.scores` (Player-indexed) cannot be handed
to a Seat-indexed display as-is: once the dealer has rotated even once, `game.scores[1]` is no
longer necessarily the running total of whoever is CURRENTLY sitting South. `(dealer + seat) % 4`
is `playerOfSeat`'s exact formula (game.ts, private), duplicated here rather than imported —
matching the established codebase convention of duplicating tiny per-seat formulas across modules
rather than widening a module's public surface for them (`windKindOf` is already independently
duplicated in `settlement.ts` and `game.ts` for the same reason, each with a comment naming the
precedent).

**Revised from the original plan.md draft**: initially scoped as an inline `App.svelte` `$derived`
array literal (no new exported symbol). Promoted to an exported `drive.ts` function during
Implement once it became clear this is the ONE place `game.dealer`'s rotation becomes
user-visible at all under Decision 2's scope (Table's wind labels never move — they're fixed to
engine Seat, not Player) — as an inline expression it would have been untestable except through
the slow, imprecise full-App mount-and-drive integration test (plan.md Step 7); as an exported
pure function it gets fast, exact `drive.test.ts` coverage (deviation noted in progress.md).

`seatScores` is passed down `App → Table → HandEnd` as a new optional `scores` prop; `HandEnd`
uses it in place of `breakdown.scores` when present (`scores ?? breakdown?.scores`), so every
existing HandEnd/Table SSR test that doesn't pass `scores` keeps asserting the OLD hand-only
fallback path unchanged (zero regression risk on ~15 existing assertions).

**Rejected: pass `game.scores` straight through, unindexed**. Cheaper (no remap function) but
mislabels money the first time a non-dealer wins or a ryuukyoku rotates the dealer — a silent,
plausible-looking bug (all four numbers still sum to 100000, still individually plausible) that
would only surface as "my score doesn't match what the table shows" during real play. Rejected on
correctness grounds, not scope — the fix costs one array literal.

**Rejected: export `playerOfSeat` from `game.ts` and import it**. Marginally more DRY, but this
ticket's footprint in `src/core/` should be zero (research.md's dependency framing — this is an
app-wiring ticket) and the formula is one line; exporting a previously-private symbol for a single
call site elsewhere widens `game.ts`'s public contract for no real reuse.

## Decision 4 — "next hand" lives on `HandEnd.svelte`, gated by its own `breakdown !== null`

**Chosen**: `HandEnd` gains one more optional prop, `onnext?: () => void`; render a "next hand"
button whenever `breakdown !== null && onnext` — no new prop-threading of "is the hand over" is
needed, `HandEnd` already computes that fact for its own rendering. `App.svelte` always passes
`onnext={newHand}` unconditionally (the button's OWN visibility guard is `breakdown !== null`);
`newHand()` no-ops if called while `table.phase === 'playing'` (defensive, matching the codebase's
"illegal tap is the caller's no-op" convention already used throughout `drive.ts`).

**Why HandEnd, not App's `.console` slot** (where `ClaimPrompt` lives): the ticket's own context
text says *""next hand" (on the score screen)"* — `HandEnd` IS the score screen (T-008-03-01's
score-breakdown screen). Co-locating the control that ends that screen with the screen itself
needs no new App-level layout slot and matches `Table`'s existing `ontap` pass-through pattern
(`Table` already forwards presentational callbacks it doesn't itself act on).

## Decision 5 — "new game" stays a header button in `App.svelte`, behavior widened in place

**Chosen**: `newGame()`'s body becomes `gameSeed = drawSeed(); hands = [[]]; dismissed = false` —
literally the same three-statement shape as today, `actions = []` widened to `hands = [[]]`. No
new button, no new component. This is the literal "absorb the existing new-game header behavior
without regression" the AC names.

## Testing strategy (elaborated fully in plan.md)

Three layers, matching "Drive/SSR tests cover both controls":
1. **SSR**: update the one existing `App`-rendering fixture (research.md §6) for the
   `handSeedOf`-derived per-hand seed; extend `HandEnd`'s SSR suite with `scores`-prop-override
   and next-hand-button-visibility cases (both fully static, no mount needed).
2. **Interactive (new `.svelte.test.ts` file)**: a `mount`-based test of `HandEnd`/`Table`
   asserting a real click on "next hand" invokes `onnext` — cheap, no bot-driving needed (mirrors
   `table.tap.svelte.test.ts`'s existing click-dispatch pattern against a hand-authored ended
   `TableState`).
3. **Interactive, full App** (new file): `vi.useFakeTimers()` + `mount(App, ...)`, a GENERIC
   "always tsumogiri own discard / always decline claim / tsumogiri own tsumo" driver loop (seed-
   agnostic — legal for any seed, guaranteed to terminate within the wall's turn bound) to reach a
   real hand end without needing an offline-mined action script, then click "next hand" and assert
   score conservation + a fresh deal, then click "new game" and assert full reset.
