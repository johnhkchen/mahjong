# Plan — T-011-02-01: window-outcome-notice

## Step 1 — `windowOutcome()` in drive.ts + unit tests

Add `CallType`, `WindowOutcome`, `isCallType`, `windowOutcome` to `drive.ts` per
structure.md. Add the `windowOutcome` test block to `drive.test.ts` using the
already-frozen seed 3/5/212 fixtures (no mining).

**Verification**: `vitest run src/app/drive.test.ts` green.

## Step 2 — `callTerm()` in dictionary.svelte.ts + ClaimPrompt.svelte refactor

Add `callTerm` to `dictionary.svelte.ts`. Delete `ClaimPrompt.svelte`'s local
`callName`, import and use `callTerm` instead.

**Verification**: `vitest run src/app/app.terminology.svelte.test.ts
src/app/app.terminology.coverage.ssr.test.ts src/app/claim-window-race.tap.svelte.test.ts`
— all green, UNCHANGED pass/fail shape (this step must not alter any existing
assertion's outcome; it's a pure refactor).

## Step 3 — `WindowNotice.svelte`

Author the component per structure.md. No test file yet — verified by Step 4's
render call succeeding and Step 5's real-mount assertions passing.

**Verification**: `just check` (svelte-check + tsc) clean — catches prop-shape
mistakes immediately, cheaper than waiting for a mounted test to fail.

## Step 4 — Terminology coverage

Add `WindowNotice` rendering to `app.terminology.coverage.ssr.test.ts` per
structure.md, with the hand-built outcome literal matching seed 3's facts.

**Verification**: `vitest run src/app/app.terminology.coverage.ssr.test.ts` green,
both terminologies' expected strings present.

## Step 5 — Wire `App.svelte`

Add the `notice` state, `NOTICE_DURATION_MS`, the auto-dismiss `$effect`, the three
handler edits (`claim`/`pass`/`takeWin`), the two reset edits (`newHand`/`newGame`),
and the cascade branch + comment, per structure.md.

**Verification**: `just check` clean. Then a manual sanity pass: run `just dev`,
open the app, and (if a claim window happens to arise during a quick playthrough)
visually confirm the notice renders and clears itself — this is a UI feature, and
`svelte-check`/unit tests alone don't prove it LOOKS right in the reserved console
slot. If no window arises quickly, this manual check is opportunistic, not blocking
(Step 6's automated suite is the real gate).

## Step 6 — Extend `claim-window-race.tap.svelte.test.ts`, confirm the "wins" reuse

First, empirically check whether the fixture's SECOND window (chi on 2s, three ticks
after the first loss) is uncontested for the player — mount the app, drive to that
point, and inspect whether tapping the chi button there settles to the player's own
action or a bot's. This determines whether Step 6 can reuse the existing fixture for
the "wins" case (design.md's primary plan) or needs one small additional mined
fixture (the fallback, using a search shaped like drive.test.ts's own seed 5/212
anchors — a much cheaper search than the original mixed-race mining, since
"uncontested claim window" is the common case, not the rare one).

Then: factor `reachFirstWindow`, flip the DEFECT assertion and add the winner/claim
content assertions on the first window, extend the walk through the second window's
resolution (asserting cascade preemption during the 750ms gap, then the outcome
afterward), and add the sibling "passed" `it`.

**Verification**: `vitest run src/app/claim-window-race.tap.svelte.test.ts` green,
covering all three AC conditions (loses/wins/passed) plus the cascade-preemption
assertion.

## Step 7 — Full-suite verification and cleanup

Run the complete suite and type-check; delete any scratch mining script used in Step
6 if the fallback path was needed (never committed, per this repo's convention).

**Verification**: `flox activate -- npm test` (or `just test`) — all files green.
`just check` — 0 errors/warnings. `git status` clean of anything but the intended
file list from structure.md.

## Testing strategy (summary)

| What | How | Why this level |
|---|---|---|
| `windowOutcome`'s loss/win/null logic | Pure unit tests, existing fixtures | Cheapest correct level; no App mount needed for pure logic |
| `callTerm`'s daiminkan→kan mapping, both terminologies | Existing `ClaimPrompt` terminology suites (unchanged pass) + new `WindowNotice` coverage | Proves the refactor didn't drift, proves the new component's strings independently |
| The notice actually appears on a real lost tap | jsdom, real `App` mount, real tap (`claim-window-race`) | Only the mounted render tree proves what the PLAYER sees, matching the AC's own wording |
| The notice never appears on a win or a pass | Same suite, same fixture, alternate branches | Directly answers the AC's "never... when it wins or when the player passed" |
| Cascade priority (claim prompt > notice) | Same suite, riding the existing 750ms reopen gap against the 2000ms dismiss timer | A real timing interaction, not just a documented intent — the strongest evidence available without a dedicated timing-unit test |
| Per-hand reset (`notice = null` in `newHand`/`newGame`) | Not directly tested this ticket (no existing fixture ends a hand immediately after a lost claim) | Matches the `dismissed` precedent defensively; flagged as an open item in review.md rather than mining a fixture solely to cover it |

## Risk / sequencing note

Step 6's empirical check (is the second window uncontested?) is the one genuine
unknown in this plan — everything else is a direct, low-risk application of
already-understood facts (T-011-01-01's fixture, drive.test.ts's existing anchors,
this codebase's established component/dictionary patterns). If the fallback mining
is needed, it slots into Step 6 without disturbing Steps 1–5's work, since those
steps don't depend on which path Step 6 takes.
