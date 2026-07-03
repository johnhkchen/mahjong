# Plan — T-011-01-01: claim-window-interaction-repro

## Step 1 — Mine the (a)/(b) fixture

Write a throwaway scratchpad script (never committed) that drives a hand
forward using the exact functions `App.svelte` calls
(`forcedAction`/`settleWindow`/`discardPolicy`/`callPolicy` via `legalActions`),
tsumogiri-ing the player's own turns, and flags the first point where a tapped
player claim would lose to a bot's answer. Scan game seeds 1–400. Record the
winning seed, the exact offered facts (tile kinds, `uses`), and how many forced
ticks separate the loss from the next window opening.

**Verification**: the scan's printed JSON is manually inspected for a
short-reopen case (a handful of ticks, not dozens) — seed 344 (reopens in 3
actions) is the pick.

## Step 2 — Write and verify `claim-window-race.tap.svelte.test.ts`

Author the suite per structure.md, using the mined facts as frozen literals
with a documenting header comment. Run it in isolation
(`vitest run src/app/claim-window-race.tap.svelte.test.ts`) and confirm it
passes on the CURRENT (unfixed) codebase — this is characterization, so a
green run here is itself evidence the fixture and assertions are accurate.

**Verification**: `vitest run` on this one file, green, first attempt (no core
or app changes were made — the test either matches reality or it doesn't).

## Step 3 — Mine the (c) fixture

A second scratchpad script, structured the same way but searching for the
narrower "ryuukyoku with exactly one offer — the player's own ron — declined"
condition. First attempt (player passively tsumogiri throughout, matching Step
1's model) found zero hits in 200,000 seeds — a static pre-filter on
dealt-tenpai + wait-tile-scarcity confirmed this combination is genuinely very
rare under passive play. Revise the mining model: the player plays his own
turns via `discardPolicy` (actively seeking tenpai, riichi offers folded to
their plain-discard twin) instead of tsumogiri. Re-scan raw hand seeds 1–20,000
under this model; 8 hits found. Pick seed 2340 for compactness (146 actions to
the dismissal, only 18 of them the player's own turns; the following hand
reaches a player claim window in just 14 actions under the same active-play
model) — both numbers need to be small since Step 4's driver walks them one
real DOM interaction at a time.

**Verification**: a follow-up scratchpad dump of the mined seed's action log,
cross-checked against a fresh `foldRecord` re-fold (fixture-sanity, this
repo's own convention) before committing to it as the test's fixture.

## Step 4 — Write the generic step-driver and `houtei-dismissal.tap.svelte.test.ts`

Author `step`/`driveUntil` (structure.md) and the one end-to-end `it` per
design.md. This is the highest-risk step (the driver must recompute, at
runtime, exactly what the mounted `App` is about to do next) — verified
directly by running it, not just reasoned about.

**Verification**: `vitest run` on this one file, green.

## Step 5 — Prove the tests are real regression guards, not vacuous

For `houtei-dismissal.tap.svelte.test.ts` specifically (the one AC item the
ticket says should "pass already" against a FIX that has already shipped):
temporarily revert commit 3bcf9d3's one line (`dismissed = false` in
`newHand()`) in `App.svelte`, re-run the suite, confirm it FAILS with the
expected assertion (the reopened prompt reads `null`), then restore the file
and confirm `git diff` shows zero changes.

For `claim-window-race.tap.svelte.test.ts`: no revert is meaningful here (there
is no fix yet to revert against — this ticket runs BEFORE E-011's fix
tickets). Confidence instead comes from Step 2's fixture-sanity assertions
(exact aria-labels, exact meld/pond facts) passing against a fresh independent
`foldRecord`/`legalActions` re-derivation inside the test itself, the same
discipline every other mined-fixture suite in this repo uses.

**Verification**: the revert-and-confirm-fail exercise (documented above),
plus a final full-suite run.

## Step 6 — Clean up and full-suite verification

Delete every scratchpad mining script (never committed — `src/app/_scratch.*`).
Run the full suite (`npm test`, i.e. `just test`) and confirm every existing
file plus the two new ones are green — the ticket's AC requires `just test`
green, not just the two new files in isolation, since the new suites mount the
real `App`/`Table`/`ClaimPrompt` components that every other suite also
exercises.

**Verification**: `flox activate -- npm test` — all test files pass.

## Testing strategy (summary)

| What | How | Why this level |
|---|---|---|
| The mixed-race arbitration itself | Already covered (`drive.test.ts`, pure functions) | Out of scope to re-test; this ticket tests the VIEW of it |
| Player sees no outcome on a lost claim | jsdom, real `App` mount, real tap | Only the mounted render tree can show "nothing tells you" |
| Consecutive windows look identical | jsdom, DOM-attribute equality between two prompt renders | Structural equality is the actual defect, not a business-logic fact |
| Houtei dismissal resets at hand boundary | jsdom, real `App` mount, revert-and-confirm-fail | Proves the existing fix is guarded, not just that today's code happens to pass |
| Full suite still green | `npm test` | The two new suites are the only changes; nothing else should move |

No unit-level (pure-function) tests are added by this ticket — `drive.ts`'s own
functions are unmodified and already covered by `drive.test.ts`. Everything new
here is an integration/interaction test by necessity (the defect lives in the
interaction between taps, timers, and render, not in any one function).
