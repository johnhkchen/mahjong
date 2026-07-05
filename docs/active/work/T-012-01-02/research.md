# Research — T-012-01-02 useful-call-prompt-filter

## The seam this ticket touches

`src/app/drive.ts` is the app/core boundary. Three functions form "the one predicate
family" its own comments describe:

- `claimChoices(offered, player)` — every raw claim offer (chi/pon/daiminkan) for
  `player`, elements of `offered`, undeduped.
- `promptChoices(offered, player)` — `claimChoices` deduped for presentation (one
  button per distinguishable call).
- `winChoice(offered, player)` — the player's tsumo/ron offer, or null.
- `forcedAction(state, offered, player)` — null exactly when the player must be
  waited on: `claimChoices(offered, player).length > 0 || winChoice(...) !== null`.
  Otherwise it either lets a bot-only window settle (`settleWindow(state, offered,
  player, null)`) or drives the ordinary turn (draw/discard/policy).

`App.svelte` renders `ClaimPrompt` exactly when `(prompt.length > 0 || win !== null)
&& !dismissed`, where `prompt = promptChoices(offered, PLAYER)`. Visibility and the
loop's wait are the SAME predicate, stated in two places by design (drive.ts's own
"one predicate family" comment, `App.svelte:74` and `:286`).

`settleWindow(state, offered, player, chosen)` is the one arbitration: player's
answer (or null for decline) joins the bots' `callPolicy` answers by `offered`
position. When `chosen` is null and nothing is taken, it returns the head draw
whenever there was anything declinable — "the window goes stale" — never `null`
unless there was genuinely nothing to fold. This head-draw arm is already how a
bot-only window auto-resolves without any player tap.

## `legalActions`'s ordering guarantee (`legal.ts:430`)

At a state with `state.drawn === null` (a claim window open), `offered[0]` is
ALWAYS `{ type: 'draw', seat: state.turn }`, followed by ron offers then claim
offers. This means `forcedAction`'s fallback arm (`if (head.type === 'draw') return
head`) is reachable and correct at exactly the states this ticket needs it for: a
window where the player holds claims but nothing forces a wait, and no bot holds a
competing offer either.

## `policy.ts`'s `callPolicy`

`callPolicy(view, offered)` is the SAME function every bot already calls at claim
windows and houtei. Three arms: an offered ron is taken unconditionally; a claim
offer is accepted iff it strictly cuts shanten AND a yaku anchor (yakuhai triplet/
pair, or kuitan-shaped tanyao) survives the post-call hand — the FIRST accepted
offer in `offered` order; otherwise the offered draw (the decline) is returned.
Never throws for a seat holding at least one ron or claim offer (`sawClaim` guard).

Calling `callPolicy(seatView(state, player), offered)` for the PLAYER's own seat is
legitimate: `seatView` is a pure projection (no privileged access), and the ticket's
own wording — "reuse the policy's own call evaluation, no new legality logic" —
names this exact call.

## `dictionary.svelte.ts` / `App.svelte`'s terminology-toggle precedent (T-010-01-02)

A tiny, proven pattern for "one localStorage key, read at boot, module-scoped
`$state` rune, guarded on `typeof window`":

```
const STORAGE_KEY = 'mahjong-terminology'
function loadStored(): Terminology { ... typeof window guard ... }
let current = $state<Terminology>(loadStored())
export function setTerminology(next): void { current = next; guarded write }
```

`App.svelte`'s header renders a button next to "new game" (`.terminology-toggle`,
≥44px target, same visual register) whose label always names the mode a tap
switches TO (never the active one). `app.terminology.svelte.test.ts` is the
reference test suite: it proves live relabeling, that toggling never disturbs the
running hand, exactly-one-localStorage-key persistence, and boot-time restore via
`vi.resetModules()` + a fresh dynamic `import('./App.svelte')`.

## `ClaimPrompt.svelte` / mount-guard (T-012-01-01, already in flight, uncommitted)

`ClaimPrompt` renders unconditionally once mounted (visibility is the owner's,
i.e. `App.svelte`'s, fact) and now additionally ignores taps for one
`MOUNT_GUARD_MS` (200ms) beat after mount (`mount-guard.ts`). Every existing
tap-driven test advances `MOUNT_GUARD_MS` before clicking a prompt button. This
convention must be respected by any new interaction test this ticket adds.

## Existing E-011/E-012 tap-suite drivers assume unfiltered claim windows

Several suites mount the real `App` and drive it with a **generic decline-everything
driver** (`step`/`driveUntil` in `houtei-dismissal.tap.svelte.test.ts`,
`window-outcome-notice.tap.svelte.test.ts`) that, on reaching ANY state where
`claimChoices(offered, PLAYER).length > 0 || winChoice(...) !== null`, asserts a
`[aria-label="pass"]` button exists and taps it — throwing otherwise. Probed
directly (fold + `callPolicy`) against the frozen fixtures used by these suites:

- `claim-window-race.tap.svelte.test.ts` (seed 344): BOTH windows in its walk (chi
  8m/6m7m, then chi 2s/3s4s) are **policy-APPROVED** — this file's own manual
  chi-tapping test needs no change; the prompt still renders under the new default.
- `houtei-dismissal.tap.svelte.test.ts`'s hand-1 chi (3m/1m2m, seed 2723775479):
  **policy-DECLINED**.
- `window-outcome-notice.tap.svelte.test.ts`'s pon/ron fixture (seed 85, the pon on
  3s/[83,80]): **policy-DECLINED**.

The declined ones would silently stop rendering a prompt under the new default,
breaking these suites' unrelated assertions (dismissal-reset regression, outcome
notice content) unless those two files opt into "prompt every legal call" for the
duration of their walk — see design.md.

## `app.controls.svelte.test.ts`'s `driveToHandEnd`

Its generic driver already tolerates an absent pass/win button (falls through to
"advance the bot-pacing timer" when nothing is clickable) — it needs NO change: an
auto-passed window is invisible to it by construction, and the mounted App's own
`$effect` advances regardless of whether a prompt rendered.

## Constraints surfaced

- `forcedAction` is called from `App.svelte` (1 site) and ~25 sites across
  `drive.test.ts`, plus `houtei-dismissal.tap.svelte.test.ts` and
  `window-outcome-notice.tap.svelte.test.ts`. Every existing call encodes the OLD
  "always wait on any player claim" semantics.
- `promptChoices`/`claimChoices` themselves are exercised by a large, unrelated
  `describe` block in `drive.test.ts` (dedup behavior, ordering) that must stay
  untouched — the filter must NOT change what these two functions return.
- No settings/toggle module exists yet for anything other than terminology; this
  ticket needs a new, sibling module.
