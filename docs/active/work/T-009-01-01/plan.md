# Plan — T-009-01-01 riichi-declaration-lock-and-stick

Each step is committed independently once its own tests are green (`just test`), per the
RDSPI phase rule ("small enough to commit atomically"). Steps 1-2 are pure refactor/plumbing
verified against the EXISTING suite before any new behavior lands; steps 3+ add riichi itself.

## Step 1 — `record.ts`: extract `performDiscard`, no behavior change

Refactor the `discard` case body into `performDiscard(state, seat, tile, index, verb)`
(structure.md). Run `just test` — every existing test must stay green with zero new
assertions. This isolates refactor risk from new-feature risk. Commit: "Extract
performDiscard from record.ts's discard case (no behavior change)".

## Step 2 — `record.ts`: `RiichiContext`, `RIICHI_STICK`, widened `TableState`/`foldRecord`,
no new `HandAction` member yet

Add the exported `RiichiContext` interface and `RIICHI_STICK` constant; widen `TableState`
with `riichi`/`pot`/`scoresIn`; widen `foldRecord`'s signature with the defaulted `context`
parameter; initialize the three new fields in `foldRecord`'s object literal. No new
`HandAction` member, no `applyRiichi` yet — this step only proves the new fields/defaulting
compile and every existing test (which never passes `context`) still sees the documented
defaults with zero behavior change. Run `just test`. Commit: "Add RiichiContext/pot/riichi-lock
fields to TableState, defaulted for existing callers".

## Step 3 — `record.ts`: the `riichi` `HandAction` member and `applyRiichi`

Add the union member, the `isMenzen` helper, `applyRiichi` (structure.md's nine-guard order),
and the `applyAction` switch case. New tests in `record.test.ts`:

- **Mining a closed-tenpai fixture**: write a throwaway (uncommitted) Node/vitest scratch
  script that tsumogiri-replays a handful of seeds and, at each turn, folds the record and
  checks `isMenzen(state.melds[seat]) && shanten(state.hands[seat].map(kindOf), []) <= 1` for
  the about-to-draw seat — the first seed/turn hitting `shanten === 0` after a specific draw
  (tenpai reached naturally by tsumogiri, no discards chosen yet) is the fixture: seed, turn
  index, seat, and the qualifying tile(s). Record the concrete seed/turn/tile numbers as
  comments in the real test, exactly like `game.test.ts`'s "mined offline" convention. If
  tsumogiri alone doesn't reach tenpai within a reasonable seed sweep, fall back to a short
  hand-authored discard sequence (still closed — never call/claim) driving toward tenpai; a
  fully closed hand needs no calls to set up, only chosen discards, so this is a bounded search.
- **Happy path**: fold the mined record plus one `riichi` action on a qualifying tile; assert
  `state.riichi[seat] === true`, `state.pot === 1000 (+ any context potIn)`, the discard landed
  in the pond exactly like an ordinary discard would, `state.turn` advanced (or ryuukyoku if
  the wall emptied), `state.claimable` opened correctly.
- **Forced tsumogiri after lock**: from the post-riichi state, an ordinary `discard` of a HAND
  tile (not the seat's next drawn tile) throws; the drawn tile discard folds normally.
- **Five illegal-riichi throws**, one fixture each (reusing the same mined tenpai fixture where
  possible, varying only the illegal condition): open hand (a hand with a pon/chi meld — mine
  or construct via an actual claim sequence), noten (declare on a tile whose removal does NOT
  leave shanten 0 — trivially any non-qualifying tile from the same fixture), `<1000` points
  (pass an explicit `context.scoresIn` with the seat below 1000), no draws left (`state.live`
  emptied — reuse `record.test.ts`'s existing `maximalRecord`-style wall-draining helper, or a
  short synthetic drain), already-in-riichi (declare twice).
- **Context defaulting**: `foldRecord(sameRecord)` with no context arg produces
  `scoresIn === [25000,25000,25000,25000]` and `pot === 0` pre-riichi (confirms Step 2's
  default reaches this new code path too).

Run `just test`. Commit: "Add the riichi HandAction: fold-time lock, stick, and legality
guards".

## Step 4 — `legal.ts`: `riichiOffers`, claim/kan suppression, offer-order update

Add `isMenzen`, the `RIICHI_STICK` import, `riichiOffers`, the `claimOffers` seat-scan guards,
and the `legalActions` `drawn !== null` branch rewrite (structure.md). Update the frozen-order
doc-comment. New tests in `legal.test.ts`:

- On the same mined tenpai fixture, `legalActions` includes exactly the expected `riichi`
  offers (one per qualifying tile) alongside the UNCHANGED ordinary discard offers (riichi
  ADDS to the discard set, never replaces it — confirms design.md's "bots ignorant of riichi
  still function" property).
- After folding one riichi offer, the NEXT `legalActions` call at that seat's following
  turn: hand-tile discards are gone (only the drawn-tile discard remains), `ankanOffers`/
  `shouminkanOffers` never appear even when the seat's hand would otherwise qualify (mine or
  construct a post-riichi draw that completes a concealed kan shape, confirm it's NOT offered).
- A claim window opened by another seat's discard: the riichi-locked seat's chi/pon/daiminkan
  offers are absent from `legalActions`'s output; a qualifying ron for that seat IS still
  present (mine a fixture where the locked seat's wait matches the discarded kind).
- Extend `legal.test.ts`'s existing "every action legalActions returns is accepted by the step
  function" property test's action universe to include the new mined riichi-bearing records —
  confirm the EXISTING property (generic over `legalActions`'s output) already covers `riichi`
  offers with no new property code, since it iterates whatever `legalActions` returns.
- `legal.win.test.ts`: one addition confirming the offered-ron-under-riichi-lock agreement
  (ron still offered, still folds), if not already covered by the fixture above — decide by
  reading the file's existing structure at implementation time before duplicating coverage.

Run `just test`. Commit: "Offer riichi in legalActions; suppress claims and kans under lock".

## Step 5 — `settlement.ts`: riichi-stick deltas and pot payout

Add the `RIICHI_STICK` import, `riichiStickDeltas`, wire it into `settlementOf` and
`scoreBreakdownOf`, add `pot` to `ScoreBreakdown`, correct the header/docstring's zero-sum
claim. New tests in `settlement.test.ts`:

- Hand-authored `TableState`-shaped fixtures (constructed the way this file already builds
  agari/ryuukyoku fixtures) with `riichi`/`pot` set: a non-riichi winner still collects a
  carried-in pot from an earlier ryuukyoku (potIn threaded via context); a riichi winner
  recovers its own stick plus the full pot; a ryuukyoku with two riichi seats pays noten-bappu
  minus 1000 each, `state.pot` (unconsumed) is NOT added to any delta.
- A conservation assertion per fixture: `deltas.reduce(sum) === state.pot's contribution`
  per design.md's algebra (agari: sums to `potIn`; ryuukyoku: sums to `-1000k`) — pin the exact
  expected numbers per fixture, not a generic property (matching this file's existing
  hand-pinned-number style).
- `scoreBreakdownOf`'s `pot` field matches `state.pot` on both `kind`s; its `deltas` match
  `settlementOf`'s output exactly for the same state (an equality assertion, proving the two
  never diverge — the header's own stated contract, made executable).

Run `just test`. Commit: "Settle riichi sticks and the pot in settlementOf/scoreBreakdownOf".

## Step 6 — `game.ts`: thread `scoresIn`/`potIn`/`pot` across hands

Add `pot` to `GameState`, the Seat-remap of `scoresIn`, the `foldRecord(..., context)` call,
and the post-hand `pot` update. New test in `game.test.ts`:

- A two-hand `GameRecord` fixture: hand 0's actions include one riichi declaration and end in
  ryuukyoku (mine via the same tenpai-search approach as Step 3, or construct minimally since
  `game.test.ts` already has mined multi-hand fixtures to extend); assert hand 1's
  `foldGame(...)`-derived `GameState.pot` equals hand 0's ending pot, and hand 1's dealt
  `TableState.scoresIn` (via `game.table.scoresIn`) matches the Seat-remapped running scores
  at hand 1's start.
- A single-hand fixture confirms `GameState.pot === 0` and default `scoresIn` when no riichi
  context ever entered the record (regression: existing single-hand `game.test.ts` fixtures
  must still pass with zero changes to their own assertions — only new assertions added).

Run `just test`. Commit: "Thread the riichi pot and per-hand starting scores through foldGame".

## Step 7 — `seatview.ts`: expose `riichi`/`pot`

Widen `SeatView` and `seatView`. New test in `seatview.test.ts`: extend an existing fixture
assertion (or add one) confirming `view.riichi`/`view.pot` equal the source `TableState`'s
fields verbatim. Run the FULL suite including `seatview.fairplay.test.ts` (no new property
needed there per design.md Decision 8 — confirm the existing hidden-tile-permutation property
still passes unmodified, since neither new field carries tile identity). Commit: "Expose
riichi lock and pot in SeatView".

## Step 8 — full-suite confirmation pass (no source changes expected)

Run `just test` and `just check` (svelte-check + tsc) once more from a clean state. Explicitly
verify (per structure.md's closing note) that `policy.ts`/`selfplay.test.ts`/`dynamics.test.ts`/
`game.dynamics.test.ts`/`purity.test.ts` all pass unmodified — bots never choose `type:
'riichi'` today (neither `discardPolicy` nor `callPolicy` recognizes it, so it is silently
skipped exactly like every other action type those functions don't branch on), so self-play
behavior, mined action-count anchors, and determinism corpora are expected to be BYTE-IDENTICAL
to before this ticket. If any anchor test's mined numbers shift, that is a signal something in
Steps 1-7 changed behavior for a NON-riichi path and must be investigated before proceeding — 
never "re-mine and move on" for a ticket that should not touch bot behavior.

## Testing strategy summary

- Unit/fold-level (record.test.ts): the authority on legality guards and mutation correctness.
- Offer-level (legal.test.ts, legal.win.test.ts): the authority on what's enumerated, locked to
  Step 3 by the existing "every offer folds" agreement property.
- Settlement-level (settlement.test.ts): hand-pinned delta fixtures, the authority on payment
  correctness and the revised conservation law.
- Game-level (game.test.ts): the authority on cross-hand threading (pot carry, scoresIn remap).
- Fairness-level (seatview.test.ts, seatview.fairplay.test.ts): the authority on public-fact
  exposure without hidden-tile leakage.
- Regression (selfplay/dynamics/policy/purity suites): MUST remain byte-identical, run last as
  a confirmation gate, not a target of new assertions.

No property test is added for the riichi mechanic itself in this ticket — that is
`T-009-01-04`'s explicit, separate job ("riichi-property-suite," depends on the yaku/furiten
tickets too). This ticket's tests are example-based/mined, matching every other single-mechanic
ticket in this codebase's history (chi/pon, kans, wins each landed with mined fixtures first;
their property suites are separate, later tickets).
