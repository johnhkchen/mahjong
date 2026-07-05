# Design — T-012-01-02 useful-call-prompt-filter

## Decision 1: filter at the wait predicate, not at `promptChoices`

**Chosen:** add one new function, `claimWindowInterrupts(state, offered, player,
promptEveryLegalCall)`, that decides whether a claim window should pause for a
prompt at all. `forcedAction` consults it in place of the raw `claimChoices(...)
.length > 0` check; `App.svelte` consults it to decide whether to render
`promptChoices(offered, PLAYER)` or an empty list.

```ts
export function claimWindowInterrupts(
  state: TableState,
  offered: readonly HandAction[],
  player: Seat,
  promptEveryLegalCall: boolean,
): boolean {
  const claims = claimChoices(offered, player)
  if (claims.length === 0) return false
  if (promptEveryLegalCall) return true
  return callPolicy(seatView(state, player), offered).type !== 'draw'
}
```

**Rejected: fold the filter into `promptChoices` itself** (give it a `state` +
toggle parameter). Rejected because `promptChoices`/`claimChoices` are exercised by
a large existing `describe` block in `drive.test.ts` proving their dedup/ordering
contract in isolation from any policy or toggle concern — widening their signature
would force touching every one of those unrelated assertions for no behavioral
reason. Keeping them pure and untouched is also what lets `claimWindowInterrupts`
reuse them as building blocks rather than duplicating claim-scanning logic.

**Why this shape wins:** the window is atomic — either it interrupts (and shows
every deduped claim button plus any win, exactly as today) or it doesn't (and
nothing renders). The ticket's own acceptance criteria never asks for
per-button filtering ("only show the approved chi, hide the declined pon") —
only "does this window get a prompt at all." A boolean predicate is the minimum
shape that answers that.

## Decision 2: reuse `settleWindow`'s existing stale-window arm for the auto-pass

**Chosen:** no new settlement code. When `claimWindowInterrupts` returns false (and
there's no win), `forcedAction` falls through past its window-wait guard into
whichever arm already exists:

- if a bot also holds an offer on the window, `settleWindow(state, offered,
  player, null)` (the existing "bot-only window" arm) — the player's decline joins
  the bots' answers exactly as today;
- otherwise `legalActions`'s own ordering guarantee (research.md) puts a `{type:
  'draw'}` at `offered[0]` whenever a window is open, so the existing `if
  (head.type === 'draw') return head` arm fires — and `settleWindow`'s own decline
  arm (`claimChoices(offered, player).length > 0 ... ? head : null`) proves this IS
  the identical result `settleWindow(state, offered, player, null)` would have
  produced. No divergent code path, just a different arm of the same function
  reached by one changed guard.

**Rejected: have `forcedAction` call `settleWindow(..., null)` explicitly for the
filtered case** instead of falling through. Rejected as redundant — research.md's
ordering proof shows the fallthrough arm already computes the byte-identical
action; adding an explicit branch would be dead-code-shaped duplication the "no
new legality logic" instruction in the ticket text warns against.

## Decision 3: `forcedAction` takes `promptEveryLegalCall` as a required 4th
positional parameter, not a default

**Chosen:** `forcedAction(state, offered, player, promptEveryLegalCall: boolean)`.
Every call site must state its intent explicitly.

**Rejected: default `promptEveryLegalCall = false`.** A default would let ~25
existing `drive.test.ts` call sites compile unchanged while silently adopting NEW
runtime semantics (auto-pass instead of wait) for any fixture whose claim happens
to be policy-declined — exactly the kind of default-hides-a-behavior-change bug
this codebase's own style (explicit `settleWindow` params, no ambient reads)
argues against. Requiring the 4th argument everywhere forces a conscious choice at
each site, and the mechanical fix is uniform: every pre-existing call passes
`true` (`claimWindowInterrupts` returns true unconditionally whenever claims
exist — the exact old "always wait" behavior), preserving every old assertion
byte-for-byte. Only `App.svelte`'s one real call site passes the live toggle.

## Decision 4: a new sibling settings module, not a widened `dictionary.svelte.ts`

**Chosen:** `src/app/call-prompt-settings.svelte.ts`, mirroring
`dictionary.svelte.ts`'s module-scoped-rune-plus-guarded-localStorage shape
exactly:

```ts
const STORAGE_KEY = 'mahjong-prompt-every-legal-call'
function loadStored(): boolean { ... typeof window guard, malformed → false ... }
let current = $state<boolean>(loadStored())
export function promptEveryLegalCall(): boolean { return current }
export function setPromptEveryLegalCall(next: boolean): void { current = next; guarded write }
```

**Rejected: add a field to `dictionary.svelte.ts`.** That module's own header is
explicit about its one job — the vocabulary dictionary — and its `TermKey` union is
already the CONTENT this ticket's toggle label reads through `term()` (Decision 5).
Bundling an unrelated boolean setting into the vocabulary module would blur that
boundary for no shared benefit; the two modules already coexist as siblings
(`dictionary.svelte.ts`/App.svelte's own toggle) and this is another one.

**Rejected: prop-drill or context-provide the flag.** Same rejection
`dictionary.svelte.ts`'s own Decision 1 (T-010-01-01) already recorded for
terminology — a module-scoped rune is simpler and every consumer (`App.svelte`,
`drive.ts`'s callers) reads it the same uniform way.

## Decision 5: the toggle's label routes through `dictionary.svelte.ts`'s `term()`,
new `TermKey` entries, following the "name what you switch TO" convention

**Chosen:** two new `TermKey` entries, `promptEveryCall` ("prompt every call" /
提示每次叫牌) and `quietCalls` ("quiet calls" / 安靜叫牌). `App.svelte`'s new
button always names the mode a tap switches TO — identical convention to
`TERMINOLOGY_LABEL`'s own button (`otherTerminology`-keyed lookup), except this
toggle's label vocabulary lives in the SHARED dictionary (the AC's own "dictionary
terms for its label," not a component-local record) since — unlike terminology
names, which don't change meaning under themselves — "prompt every call" is
itself game vocabulary that should read naturally in either terminology, the same
class of string `declareRiichi`/`notYet` already are.

**Rejected: a component-local `Record<boolean, string>` like
`TERMINOLOGY_LABEL`.** Rejected specifically because the AC calls out "dictionary
terms for its label" — a signal this string is meant to be terminology-aware
prose, not the terminology-NAME special case `TERMINOLOGY_LABEL` intentionally
carves out (design.md Decision 4, T-010-01-02).

## Decision 6: pre-existing E-011 tap suites opt into `promptEveryLegalCall(true)`
for the duration of their own walk, rather than restructuring their drivers

**Chosen:** `houtei-dismissal.tap.svelte.test.ts` and
`window-outcome-notice.tap.svelte.test.ts` call `setPromptEveryLegalCall(true)`
before mounting (mirroring `setTerminology`'s reset-in-`afterEach` convention) —
their fixtures include claim windows research.md found to be policy-DECLINED
(the houtei-hand-1 chi, the seed-85 pon), which would otherwise stop rendering a
prompt at all under the new default and break their generic `step()` drivers'
"expect a pass button" assumption.

**Rejected: make `step()` DOM-adaptive** (check whether a prompt actually rendered
before deciding to tap vs. let `forcedAction` auto-advance). This works
mechanically but changes files whose entire purpose is unrelated to this ticket
(a dismissal-reset regression test, an outcome-notice content test) for a concern
that a one-line toggle-on setup fully absorbs — smaller diff, and it keeps those
suites asserting exactly what they asserted before this ticket existed, which is
the "extends the fixtures rather than duplicating them" instruction read
literally: extend the SETUP, not the driver logic.

**`claim-window-race.tap.svelte.test.ts` needs no change at all** — research.md
confirms both of its windows are policy-APPROVED, so the new default already
renders its prompts identically to before.

## New coverage this ticket adds (not already implied by moved code)

- `drive.test.ts`: a `describe('claimWindowInterrupts', ...)` block — declined-only
  window + toggle off ⇒ false; same window + toggle on ⇒ true; approved-claim
  window + toggle off ⇒ true; win-only state ⇒ untouched by this predicate (only
  `winChoice` governs); no-window state ⇒ false without invoking `callPolicy` (so
  it never throws off-window).
- `forcedAction`: one declined-window fixture asserting non-null (auto-settle) at
  `promptEveryLegalCall = false` vs. null (wait) at `= true`, using the SAME
  state.
- A new end-to-end tap suite, `call-prompt-filter.tap.svelte.test.ts`, mounting
  the real `App`: default setting auto-passes a policy-declined window (no prompt
  ever renders, play proceeds); a policy-approved window still prompts by
  default; toggling "prompt every call" on makes the SAME declined window prompt,
  live; the choice persists across a simulated reload (the
  `vi.resetModules()` + fresh `import('./App.svelte')` pattern from
  `app.terminology.svelte.test.ts`); both terminologies render the toggle's own
  label correctly.
