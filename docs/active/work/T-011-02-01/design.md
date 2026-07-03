# Design — T-011-02-01: window-outcome-notice

## Decision summary

A pure `windowOutcome(chosen, settled)` function in `drive.ts` (reference-equality
check, per research.md's invariant) feeds a new `notice: WindowOutcome | null`
`$state` in `App.svelte`, rendered by a new `WindowNotice.svelte` component inserted
into the console cascade between the claim prompt and the riichi prompt. A shared
`callTerm()` helper (promoted from `ClaimPrompt.svelte`'s private `callName`) names
call types identically in both places. Auto-dismiss is a 2000ms timer, deliberately
longer than the existing race fixture's 750ms reopen gap so that fixture also proves
cascade preemption. `claim-window-race.tap.svelte.test.ts` (T-011-01-01's file) is
extended, not left alone: its DEFECT marker flips, its walk continues one window
further for the "wins" case, and a sibling `it` covers "passed."

## Where the outcome comparison lives

### Option 1 — inline in App.svelte's claim()/takeWin()
Compare `settled !== action` directly in the handlers, building the notice payload
there. **Rejected.** The ticket's own Context section states the seam directly:
"the drive returns/exposes who won the window and with what; the view renders it,
computes nothing." `App.svelte`'s own architectural header makes the same promise for
every other derived fact (`prompt`, `win`, `riichi`, `hint` are all `drive.ts`
functions over `offered`/`table`). Computing the comparison inline would be the one
console fact NOT sourced from `drive.ts`, breaking the file's own established pattern
for no clear benefit.

### Option 2 — a pure `windowOutcome()` function in drive.ts
**Chosen.** Takes `chosen: HandAction` (the player's tapped claim or win — already an
`offered` element by construction) and `settled: HandAction | null` (`settleWindow`'s
return) and returns a `WindowOutcome` fact or `null`. `App.svelte` calls it once per
`claim()`/`takeWin()` and assigns the result straight to `notice` — genuinely
computation-free at the call site, matching every other `$derived`/handler pattern in
the file.

## Equality check: reference vs shape

### Option 1 — shape equality (type + seat + tile + uses)
Rejected: more code, and duplicate-copy claim variants (two chi options differing
only in which physical tile a `uses` slot names) make a naive shape comparison risk
either a false match (ignoring `uses` entirely) or added complexity (comparing `uses`
tuples element-wise) for no benefit over the simpler option below.

### Option 2 — reference equality (`settled === chosen`)
**Chosen**, per research.md's invariant: `chosen` is always an `offered` element
(never constructed), and `settleWindow` seeds `best = chosen` before consulting bots,
overriding it only with a DIFFERENT object (a bot's own `callPolicy` answer). `===`
is exact, cheap, and already the discipline `drive.test.ts` uses everywhere else
("the teeth are identity... a returned action IS an element of the offered array,"
per that file's own header).

## The component: new file vs inline markup

### Option 1 — inline `<p>` inside App.svelte's console block, like the tenpai hint
Rejected: the hint is a single literal string with no internal composition. This
notice composes a seat name (`windTerm`) and two call names (`callTerm`) around fixed
English scaffolding — closer in shape/complexity to `RiichiPrompt.svelte` (which
composes a tile + two term calls) than to the bare hint paragraph.

### Option 2 — new `WindowNotice.svelte`, matching ClaimPrompt/RiichiPrompt's shape
**Chosen.** One prop (`outcome: WindowOutcome`), zero input wiring (no buttons — this
is not a decision point, only a transient fact), a small `<style>` block in the same
dark-felt palette. Matches this codebase's established "one small component per
console branch" pattern for anything beyond a bare string.

## The daiminkan→"kan" naming rule: duplicate vs share

### Option 1 — duplicate a private `callName`-shaped helper inside WindowNotice.svelte
Considered, since this repo has an explicit precedent for duplicating small helpers
across TEST files rather than extracting a shared module (T-011-01-01 design.md's
own rejected-shared-test-utility decision). Rejected here anyway: that precedent is
scoped to test-fixture-driving helpers, each telling its own "how this fixture was
mined" story where duplication is a FEATURE (independence). This is a business-vocab
rule ("a daiminkan is called kan at the table") that must render as the literal same
word in two PRODUCTION components describing the same call — a second private copy
risks silent drift (e.g. one file's mapping updated for a future call form, the
other's not) with no corresponding benefit.

### Option 2 — promote `ClaimPrompt.svelte`'s local `callName` into `dictionary.svelte.ts` as `callTerm()`
**Chosen.** `dictionary.svelte.ts`'s own header calls itself "the one label
dictionary" for user-facing vocabulary — a call-type-to-word mapping belongs there
by that file's own charter, not privately duplicated per component. Mechanical move:
`ClaimPrompt.svelte` imports `callTerm` instead of defining `callName` locally;
`WindowNotice.svelte` imports the same. No behavior change for `ClaimPrompt` (byte-
identical output), verified by the existing `ClaimPrompt`-touching suites staying
green unchanged.

## Auto-dismiss duration

**Chosen: `NOTICE_DURATION_MS = 2000`** — a readable beat, comfortably longer than
`BOT_DELAY_MS` (250ms) so it doesn't read as fighting the bot pacing, AND
deliberately longer than the 750ms gap `claim-window-race.tap.svelte.test.ts`'s own
mined fixture already has between the first window's loss and the second window's
open. This is intentional, not coincidental: it means the notice is still logically
"live" (`notice !== null`) at the moment the second claim prompt arrives, so that
fixture's existing walk becomes a real proof of cascade preemption (claim prompt
outranks a still-live notice) for free, with no extra mining. Rejected a shorter
duration (e.g. 750ms, timed to clear exactly before the second window) as needlessly
precise/fragile — coupling this ticket's timer to another ticket's exact fixture
timing would make either one brittle to the other's future changes; longer-than
comfortably clears that bar without being timing-exact.

## Clearing a stale notice on every resolution path

`claim()`/`takeWin()` always assign `notice` (a fresh outcome or `null`) — never
leave the prior value in place, so a WIN correctly clears any previous LOSS notice
still displayed. `pass()` is also touched: it explicitly sets `notice = null`, even
though it never produces one.

**Why not leave `pass()` untouched, relying on the timer alone?** Rejected: the timer
could still have up to ~2000ms left when the player passes a LATER, unrelated
window — leaving a stale notice describing the WRONG (earlier) event visible after an
intervening pass, violating "never... when the player passed" at the exact moment
that AC cares about. Explicit clearing is simpler than reasoning about the timer's
remaining duration and is exactly correct with no race.

## Per-hand reset

`notice = null` added to both `newHand()` and `newGame()`, mirroring `dismissed`'s
own two reset sites verbatim — the identical bug class T-011-01-01(c) already
regression-tests, applied prophylactically to a second piece of ephemeral state
before it can ever leak across a hand boundary (no test currently exercises this path
for `notice` since no hand in existing fixtures ends immediately after a lost claim,
but the reset costs nothing and matches established discipline).

## Console cascade: order and where it's documented

```
{#if (prompt.length > 0 || win !== null) && !dismissed}      claim prompt — a live decision, always wins
{:else if notice !== null}                                    outcome notice — informational, transient
{:else if riichi !== null}                                    riichi prompt — the next per-turn decision
{:else if hint !== null}                                       tenpai hint — ambient teaching, lowest priority
{/if}
```

A comment block goes directly above this `{#if}` in `App.svelte` (extending the
existing comment there) spelling out the four tiers and the rationale: a live
decision always preempts a stale notice (never hide an urgent tap behind a toast); a
notice always preempts the ordinary per-turn cascade beneath it (the player should
learn what just happened before being asked what's next); riichi/hint keep their
existing relative order unchanged.

## Testing strategy

### Pure-function coverage (`drive.test.ts`) — no new mining
`windowOutcome()` unit tests reuse three ALREADY-FROZEN fixtures (research.md):
seed 3's `raceWindow3` (South's pon beats East's chi — LOSS), seed 5's `ponWindow5`
and seed 212's `kanWindow212` (East's own claim uncontested — WIN, two different call
types). Plus defensive unit cases: `settled === null` → null, `settled === chosen` →
null (the reference-equality contract itself).

### Terminology coverage (`app.terminology.coverage.ssr.test.ts`)
`WindowNotice` rendered directly (like `ClaimPrompt`/`RiichiPrompt` already are in
this file) with a hand-built `WindowOutcome` prop, under both terminologies — matches
this file's own "every AC-named surface" charter without driving a whole interactive
scenario just for string coverage.

### Interactive coverage (`claim-window-race.tap.svelte.test.ts`, T-011-01-01's file)
This IS "the repro suite's mixed-window sequence" the AC names, so it is extended
rather than left alone:
- The existing DEFECT assertion (no notice element) flips to asserting the notice
  IS present and names West + pon (winner) and the player's own chi (loser) — the
  LOSS case, in the app-mounted, real-tap context the AC asks for.
- The walk continues into the ALREADY-mined second window (chi on 2s, three ticks
  later) and taps it; if empirically uncontested (to be confirmed in Implement — see
  research.md), asserts `notice` clears/absent afterward — the WIN case, reusing the
  same fixture rather than mining a new one. Fallback if it turns out contested: mine
  one small additional uncontested-claim fixture (a much easier search than a race,
  per drive.test.ts's own seed-5/212 anchors existing at the pure level already —
  worst case, adapt one of those to an App-mounted walk).
- A new sibling `it` reruns the SAME seed-344 setup through the first window, tapping
  PASS instead of chi, asserting no notice appears — the PASSED case, zero new
  mining (same fixture, alternate branch). A small local `reachFirstWindow(target)`
  helper is factored out for the two `it`s to share (in-file DRY; this is not the
  cross-FILE test-utility module T-011-01-01 rejected, just avoiding duplicating five
  lines twice in one file).
- The cascade-preemption proof rides along for free: at the moment the second window
  opens (750ms after the loss), `NOTICE_DURATION_MS = 2000` guarantees the first
  notice is still logically live, so asserting the CLAIM PROMPT (not the notice) is
  what renders there is itself the cascade-priority test the AC asks for.

## Explicitly NOT in scope

- The fresh-prompt-beat / remount-keying fix for consecutive windows (T-011-02-02).
- Any change to `settleWindow`'s arbitration semantics or `src/core/`.
- New `TermKey` dictionary entries (none needed — existing keys cover every string).
- Generalizing the notice beyond `chi`/`pon`/`daiminkan`/`ron` losses: `tsumo` can
  never lose (no competing bot offer coexists with a tsumo point — research.md), so
  `windowOutcome()` handles it for type-generality only; no test targets it directly.
