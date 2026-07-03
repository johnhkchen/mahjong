# Design — T-011-02-03: window-legibility-regression-suite

## Decision 1: land T-011-02-01's uncommitted implementation as its own commit(s) first

**Options considered:**
- (a) Fold T-011-02-01's diff silently into this ticket's own commits.
- (b) Commit T-011-02-01's code as its own prep commit(s), matching the sibling
  ticket convention (`c5f5a2f`/`0a43ee9` then `77fb87d`; `279f6dc` then `f779a4e`),
  before starting this ticket's own Implement phase.
- (c) Leave it uncommitted and let a future sweep handle it.

**Chosen: (b).** The working tree is the ground truth this ticket builds on
(research.md), but git history should still attribute WindowNotice.svelte, the
`drive.ts`/`dictionary.svelte.ts` additions, and their tests to T-011-02-01, not to
this ticket. (a) would misattribute a whole prior ticket's work under a "T-011-02-03:
..." message; (c) leaves a ticket marked `done` with nothing in history, which is
worse than either. Ticket frontmatter files themselves are excluded from this commit
(research.md's own observation: no commit in this repo's history has ever touched a
`docs/active/tickets/*.md` phase field — that bookkeeping is Lisa's alone).

## Decision 2: the outcome-notice chi/pon/ron × terminology matrix lives at the SSR/hand-built layer, not as three new interactive fixtures

**Options considered:**
- (a) Mine three independent interactive (real-tap) fixtures — one pure chi-loses,
  one pure pon-loses, one pure ron-loses — each run under both terminologies.
- (b) Parameterize the EXISTING `app.terminology.coverage.ssr.test.ts` "outcome
  notice" describe block into a data table covering all three call types (plus the
  already-present daiminkan-as-kan case) × both terminologies, using hand-built
  `WindowOutcome` literals (as it already does for its two existing cases) — no new
  mining. Keep exactly ONE new interactive fixture (research.md's mined pon/ron
  window) to prove the notice's CONTENT is real end-to-end, not just component-level.
- (c) Add the matrix only at the `drive.test.ts` pure-function layer, drop the SSR
  terminology angle entirely.

**Chosen: (b).** `windowOutcome` never touches the fold (research.md) — a hand-built
`WindowOutcome` is not a simplification of reality, it IS the full input the real
function receives at the App call site (`notice = windowOutcome(action, settled)`
assigns a value of exactly this shape). Option (a) would be the most thorough but
costs an atamahane-ron-vs-ron mining effort (research.md: not attempted, materially
harder than the pon/ron fixture already found) for marginal confidence beyond what
(b) + the one real interactive fixture already buys. Option (c) drops the AC's
explicit "× both terminologies" for the notice, which the SSR file already does well
— reversing existing coverage would be a regression, not a simplification.

The data table:

| winnerType | playerType | Source |
|---|---|---|
| pon | chi | existing (seed-3-derived, hand-built) — kept verbatim |
| daiminkan | pon | existing (hand-built) — kept verbatim |
| ron | pon | **new**, hand-built (mirrors research.md's mined interactive fixture's actual outcome — cross-checked against it, not invented) |
| ron | ron | **new**, hand-built (the atamahane case — synthetic `HandAction`s, no fixture; `windowOutcome` doesn't need one, see research.md) |

Four rows × two terminologies = 8 `it`s (or one parameterized loop over the table),
inside the existing per-terminology `describe` block — additive, no restructuring of
the file's existing loop-over-`TERMINOLOGIES` shape.

## Decision 3: one new interactive fixture (mined pon/ron window), parameterized over both terminologies, extending the existing chi fixture the same way

**Options considered:**
- (a) A brand new file, duplicating claim-window-race's mount/tick/driver scaffolding
  a third time.
- (b) Add the new fixture as a new `describe` block inside
  `window-outcome-notice.tap.svelte.test.ts` (already holds the pass-case and
  win-case siblings to the race file's loss-case) — and ALSO wrap that file's
  existing two `it`s plus this new one in a `for (const terminology of
  TERMINOLOGIES)` loop, calling `setTerminology(terminology)` at the top of each and
  resetting in `afterEach` (the SSR file's own convention).
- (c) Parameterize `claim-window-race.tap.svelte.test.ts`'s existing seed-344 `it`
  over both terminologies too, in the same pass.

**Chosen: (b) + (c), both.** They're the same mechanical change (wrap an existing
`it` in a terminology loop, assert `callTerm(type)`/`windTerm(seat)` instead of
literal English strings) applied to both interactive files that currently assume
romaji. Doing both in one ticket is what actually satisfies "the full window-
lifecycle story...covered across chi/pon/ron in both terminologies" — seed 344 (chi,
already the fullest lifecycle walk: open→lose→notice→reopen→remount→cascade-
preempt) gets terminology coverage for the "chi" leg, and the new pon/ron fixture
gets it for the other two. (a) would triple the mount/tick scaffolding for no
benefit — `window-outcome-notice.tap.svelte.test.ts` already exists as the
"secondary outcome-notice fixtures" file and the new case is exactly that.

Concretely, `callButtons`/`claimPrompt`/`noticeEl`/`tickUntil`/`mountApp` helpers in
both files stay as they are (byte-identical duplication is this repo's own
established per-file convention, restated in research.md's constraints); only the
assertion VALUES change per terminology (`t.pon`/`t.ron`/`windTerm`-shaped strings
instead of hardcoded `'West'`/`'pon'`/`'chi'`), mirroring
`app.terminology.coverage.ssr.test.ts`'s own `EXPECTED` table shape (duplicated
locally rather than imported, for the same reason that file gives: importing from
the module-private TERMS table would make assertions tautological).

## Decision 4: the new fixture also closes T-011-02-01 review.md's open concern #2

The mined pon/ron window ends the hand (a ron always does) — the FIRST fixture in
this repo where a notice is showing at the exact moment `newHand()` fires. Asserting
`notice` is null immediately after clicking "next hand" (and that the next hand's
own first prompt, if reached, is unaffected) directly exercises the untested
`notice = null` reset path T-011-02-01 flagged. This is not new scope invented by
this ticket — it is exactly the "own it or flag it" gap the epic's closing ticket is
supposed to pick up, and it falls out of the fixture already needed for Decision 3
at zero extra mining cost.

## Decision 5: leave the atamahane (ron-loses-to-ron) case at the pure/SSR layer only — do not mine it interactively

**Rejected: mining a real double-ron interactive fixture.** research.md's finding:
this needs a materially different search (two simultaneous ron offers on the same
discard where the player's is not first in rotation — a shanpon-style double-ron
geometry) that a 50000-seed scan for the simpler "claim + ron" shape did not
incidentally surface. `windowOutcome`'s own contract (Decision 2) makes the pure/SSR
coverage a complete, honest test of the function's behavior in this case — the
gap this leaves is identical in kind to T-011-02-01 review.md's own item 3 ("noted
in design.md as a deliberate scope call, not an oversight"), now actually paid down
one layer (pure function + SSR render, up from pure-function-only) rather than left
exactly where it was. A future ticket that wants the fully interactive atamahane
proof would need its own dedicated mining pass — flagged in review.md, not treated
as silently resolved.

## Non-goals

- No changes to `src/core/`. The `game.dynamics.test.ts` flakiness (research.md) is
  out of scope — flagged for a follow-up ticket, not touched here.
- No new shared test-helper module (research.md's constraints section).
- No attempt to cover EVERY `(winnerType, playerType)` pair combinatorially (e.g.
  daiminkan-loses-to-ron, chi-loses-to-daiminkan) — the AC's own wording is
  "chi/pon/ron windows," three call types, not an exhaustive cross product; Decision
  2's four-row table already covers every AC-named type as both a winner and a
  player-tap where that direction is reachable at all (chi can never win — legal.ts's
  own frozen precedence puts it last — so "winnerType: chi" is not a real state and
  is correctly absent from the table).
