# Design — T-011-01-01: claim-window-interaction-repro

## Decision summary

Two new `*.tap.svelte.test.ts` suites, mounting the REAL `App` component (no core
or app source changes): one scripts the mixed-race + reopened-window sequences
(AC items a+b, one mined fixture covers both), the other scripts the houtei
dismissal regression (AC item c). Both drive the app via real DOM taps and fake
timers, matching the established `app.riichi.tap.svelte.test.ts` precedent.

## Option space for (a)/(b): how to reach the mixed-race window

### Option 1 — mount `App`, mine a fresh game seed under real policy-bot driving
Drive the mounted `App` (fake timers + real taps) forward, tsumogiri-ing the
player's own turns, until a state naturally arises where the player's tapped
claim would lose to a bot's higher-priority claim. **Chosen.** This is the only
option that exercises `App.svelte`'s actual `claim()`/`pass()` closures (the
functions with the defect — no branch anywhere compares "what I tapped" to "what
got pushed") through their real render path, which is the whole point of a
characterization test: pin what the PLAYER SEES, not just what `settleWindow`
returns (already covered at the pure-function level by `drive.test.ts`).

### Option 2 — reuse `drive.test.ts`'s existing seed-3 race fixture (`racePrefix3`)
`drive.test.ts` already has a frozen "loses the seed-3 race to South's pon"
fixture. Rejected: that fixture's prefix is a literal ALL-TSUMOGIRI sequence for
all four seats (`tsumogiriTurns`), which is how fixtures were mined *before*
T-006-03-03 added real policy bots. `App.svelte`'s bots use `discardPolicy`
today — a real mounted `App` will never naturally reach that exact prefix (its
own bots would discard by shanten-minimizing policy, not tsumogiri, from turn
one). Reusing it would require constructing the `App`'s internal `hands` state
directly, which the component doesn't expose — see Option 3.

### Option 3 — bypass `App`, mount `Table.svelte` + `ClaimPrompt.svelte` directly with a hand-built `TableState`
Precedent: `table.tap.svelte.test.ts` mounts `Table` directly with a
`foldRecord`-built state and its own local tap wiring. Rejected for THIS ticket's
(a)/(b): it would test the render/tap mechanics of `ClaimPrompt`/`Table` in
isolation, wired through a re-implementation of `claim()`/`pass()` in the test
itself — not `App.svelte`'s actual, currently-defective closures. Since the whole
finding is "the app's own handlers have no branch for a lost window," a
synthetic harness that reimplements those handlers can't characterize that
defect; it would just re-prove what `drive.test.ts` already proves at the
function level. (Kept in mind as a fallback if fresh mining had failed — it
didn't.)

### Mining outcome
A scratchpad scan (game seeds 1–400, tsumogiri on the player's own turns, real
`forcedAction`/`settleWindow`/`discardPolicy`/`callPolicy` everywhere else) found
seed 344 (core, hand-0) inside a few seconds: a mixed pon/chi window where the
player's only chi choice loses to West's pon, and — three forced ticks later —
North's own next discard opens a SECOND, differently-tiled but same-shaped chi
window. One fixture, both AC items. No larger search was needed.

## Option space for (b): "consecutive windows on the same kind"

### Option 1 — treat it as the SAME event chain as (a)
**Chosen.** E-011's own intent section describes the race-loss and the
reopened-window-reads-as-a-repeat as one continuous symptom ("the tapped call
loses... and the winner's next discard often opens a similar-looking window
~250ms later: the dialog 'didn't take' and 'appeared twice'"). The mined seed-344
fixture's second window (chi on 2s) opens 3 ticks after the first (chi on 8m)
closes — same call type, same one-button `ClaimPrompt` shape, no distinguishing
marker — which is exactly this description. Treating it as one scripted sequence
matches the epic's own framing and avoids mining and maintaining a second,
unrelated fixture for a symptom already reproduced.

### Option 2 — mine an independent "two same-kind windows" fixture unrelated to a race
Considered: find a seed with two ordinary (non-racing) chi windows back to back.
Rejected: strictly weaker evidence (doesn't also demonstrate the race-loss) for
extra mining cost, when the chosen fixture already demonstrates the "looks
identical" defect with a stronger, real-world-reported trigger (the race loss
that leads directly into it).

### What the test actually asserts for (b)
Structural identity: `aria-label` and `className` are literally IDENTICAL between
the two prompt renders (`toBe`, not `toEqual` — this is Svelte's own re-render of
the one console `{#if}` branch, not two different elements). This is the exact
"no fresh-prompt beat" gap E-011's Done section names as what the fix must add
— the assertion to flip once that beat exists.

## Option space for (c): the houtei dismissal regression

### Option 1 — reuse the old core-level `HOUTEI_SEED = 1038928` anchor
Rejected outright, and documented as such in research.md: `drive.test.ts`'s own
header explicitly warns this seed's houtei geometry does not survive real
policy-bot driving (a bot rons the player early instead, via West's ittsuu).
`App.svelte` always drives its bots through real `discardPolicy`/`callPolicy` —
there is no way to substitute literal tsumogiri for the bots via the UI. Any
fixture for an `App`-mounted test must be mined fresh under real policy driving.

### Option 2 — static pre-filter (dealt-tenpai + wait-tile-scarcity) over a huge seed range, tsumogiri-only player
Tried first (research.md). The player-tsumogiri-only model means the player's
tenpai status is fixed at the deal and never improves; combined with requiring
the wait tile to have exactly one surviving copy anywhere in the game (so
furiten from an earlier decline can never foreclose the houtei offer), this
combination did not appear once in 200,000 seeds. Confirmed too rare to mine
practically for a single ticket's regression coverage. Abandoned.

### Option 3 — player plays like a bot on his own turns (discardPolicy, riichi declined to its discard twin), still declining every claim/win
**Chosen.** Actively seeking tenpai (rather than passively tsumogiri-ing) raises
the odds enormously: 8 hits inside the first 20,000 raw seeds (~4 minutes of
scripted search). Seed 2340 was picked from the hits for compactness: hand 0
reaches the lone-houtei-ron dismissal in 146 actions (18 of them the player's own
discards — all plain discards, no riichi ever declared, keeping the App-mounted
driver's job simple), and hand 1 (continuing from the SAME game seed) reaches a
claim window for the player in just 14 actions (2 of the player's own discards).
Both numbers are small enough for a real, un-hardcoded step-by-step DOM driver
to run quickly and legibly.

### Why a generic step-driver instead of hardcoding the mined action list
The mined `actions` array is 146 elements long for hand 0 alone — reproducing it
as a literal, hardcoded tap sequence in the test would be unreadable and
fragile (any of `discardPolicy`'s choices changing for unrelated reasons would
silently desync a hardcoded script from what the real mount actually does).
Instead, `houtei-dismissal.tap.svelte.test.ts` computes what to do at each step
from a state fold built ALONGSIDE the mount, using the exact same functions
`App.svelte` itself calls (`forcedAction`, `discardPolicy`, `riichiPrompt`,
`settleWindow`) — the driver and the mounted app can never disagree about what
happens next, by construction, so the test stays exact without being a wall of
literals. This is the same idea `app.riichi.tap.svelte.test.ts`'s `tickUntil`
already uses (driving via a predicate, not a step count), extended one level: the
predicate now also decides WHICH tap to make, not just when to stop ticking.

### Validated as a real regression guard
Before finalizing, the fix (`dismissed = false` in `App.svelte`'s `newHand()`)
was temporarily reverted and the new test re-run: it failed exactly as expected
(the reopened prompt read `null`). The fix was restored (verified via `git diff`
showing zero changes) before finalizing this ticket's work. This is the
concrete evidence the ticket's "the houtei-reset regression passes already"
line asks for.

## Rejected: a shared test-utility module for the mining helpers

Both new suites contain small, very similar step-driving helpers
(`tickUntil`/`step`/`driveUntil`). Considered extracting a shared
`src/app/test-drive.ts` helper module. Rejected for this ticket: `research.md`
notes this repo has NO shared test-utils module anywhere in `src/core/` or
`src/app/` today — duplication across test files, each documented with its own
frozen-fixture comment, is the established convention (drive.test.ts's own
header cites this precedent for `tsumogiriTurns`/`dealtLive`). Introducing a
shared module for two call sites would be a scope expansion beyond what this
characterization ticket asks for, and would obscure each suite's own
self-contained "how this fixture was mined" story.

## What is explicitly NOT in scope here

- No change to `settleWindow`, `App.svelte`'s handlers, or `ClaimPrompt.svelte` —
  E-011's later tickets (T-011-02-*) own the actual UI fix (an outcome notice, a
  fresh-prompt beat). This ticket only pins today's behavior.
- No terminology-toggle coverage for the new suites (E-011's Done section asks
  for "both terminologies covered" as part of the EPIC's overall done state, not
  this characterization ticket specifically — the fix tickets that add new
  user-facing text are where that coverage belongs).
