# Research — T-011-02-02: fresh-prompt-beat

## Ticket in one line

Consecutive claim-window prompts must read as distinct events: give the console's
`ClaimPrompt` a CSS-only entry beat (~150-250ms, `prefers-reduced-motion` honored) and
key it on window identity (claimable seat+tile) so a new window always remounts —
never patches — the prior prompt's DOM. No new delay, no core changes.

## Where E-011's diagnosis leaves off

T-011-01-01 (done) characterized two legibility gaps in one owner-reported symptom
("the chi dialogue appears twice... seems like a race condition"): (1) a lost claim
has no visible outcome (T-011-02-01's scope), and (2) consecutive windows render with
no distinguishing marker (this ticket's scope). Its `claim-window-race.tap.svelte.test.ts`
already pins fixture facts I reuse: game seed `2654435561` (core hand-0 seed `344`)
reaches a window where the player's only chi (`8m` via `[37,44]`) loses to West's pon,
and three forced ticks later North's own discard opens a second, differently-tiled chi
(`2s` via `[83,87]`) — same call type, same one-button `ClaimPrompt` shape. The second
`// DEFECT:` block (lines ~144-153) asserts the two prompt nodes' `aria-label` and
`className` are `toBe`-equal, with a comment marking it as the assertion this ticket's
fix flips.

## The one render site

`src/app/App.svelte` (322 lines) — the console `{#if}` (lines 222-236):

```
{#if (prompt.length > 0 || win !== null) && !dismissed}
  <ClaimPrompt claimed={table.claimable?.tile ?? null} choices={prompt} {win} ... />
{:else if riichi !== null} ... {:else if hint !== null} ... {/if}
```

- `prompt` (`$derived`, line 71) = `promptChoices(offered, PLAYER)` — deduped chi/pon/kan
  offers.
- `win` (`$derived`, line 72) = `winChoice(offered, PLAYER)` — the player's tsumo/ron.
- `dismissed` (`$state`, line 76) — houtei-only, reset in `newHand()`/`newGame()`.
- No key, no transition anywhere on this branch today. `ClaimPrompt` is a bare
  component reference; Svelte's own `{#if}`/`{:else if}` reconciliation decides
  mount/patch/unmount, not any explicit identity.

`src/core/record.ts:271` — `claimable: { readonly seat: Seat; readonly tile: TileId } |
null`, the ticket's own "window identity" vocabulary verbatim. Set at line 1041 on every
discard (`state.claimable = { seat, tile }`); nulled on every claim/win resolution
(lines 471, 620, 910, 1196) and implicitly stale once a new draw supersedes it (record.ts's
own error strings: "the discard went stale on the next draw"). `legal.ts:442-443` reads
this same field for ryuukyoku's houtei-ron offering — so a houtei window is *also* a
`claimable`-keyed window, not a special case.

`src/app/ClaimPrompt.svelte` (160 lines) — pure input wiring, one root `<aside
class="prompt" role="group" aria-label="call or pass">`. No motion styling exists here
today (`<style>` block, lines 92-160, is layout/color only).

## What actually happens today between two windows (verified against the existing test)

`claim-window-race.tap.svelte.test.ts` proves — not assumes — that the FIRST window's
close already produces a real gap: immediately after the losing tap,
`expect(claimPrompt(target)).toBeNull()` passes, meaning the `<aside>` is fully absent
from the DOM (not hidden), so Svelte's `{#if}` chain already destroys the ClaimPrompt
instance when neither branch condition holds. The SECOND window's prompt (three ticks
later) is therefore already a fresh mount by incidental construction — the gap is wide
enough (West's claim discard, North's draw, North's discard, all real appended actions)
that no continuously-true span of the `{#if}` condition spans the two windows in this
fixture. **This is a load-bearing constraint on Design**: the existing race fixture
cannot, by itself, demonstrate a *patch* Regression if the key were absent — the defect
is presentation register (no visible beat, no architectural guarantee), not today's
observed DOM churn.

## Existing CSS-only motion conventions (E-007, must match, not invent)

`src/app/Table.svelte` (lines 353-427) and `src/app/HandEnd.svelte` (lines 138-149) are
the only precedent. Two distinct shapes, both wrapped in `@media
(prefers-reduced-motion: no-preference)`, both from-only (no explicit `to`, so reduced
motion means the block simply never applies and elements appear directly in their
settled style):

1. **State-change-on-a-recreated-element**: `animation: name Xms ease-out` +
   `@keyframes name { from { ... } }`. Used for melds/claimed-tile marks — Table.svelte's
   own comment: "the claimed branch swap recreates the li, which is what fires this... a
   class toggle on a kept li would not restart it." 200ms (`meld-settle`, `claim-turn`,
   `claim-taken`), 220ms (`HandEnd`'s `reveal-rise`).
2. **Insertion transition**: `transition: opacity Xms ease-out, transform Xms ease-out;`
   + `@starting-style { opacity: 0; transform: translateY(...); }`. Used for draw/discard
   entrances (`.pond li`, `.drawn`, both 180ms) — Table.svelte's own comment:
   "insertion transitions via `@starting-style` (transitions are client-only, so SSR
   output is untouched...)." Explicitly the mechanism this codebase chose over Svelte's
   built-in `transition:` directive.

Both shapes size their duration to fit inside `BOT_DELAY_MS` (250ms, App.svelte line 96)
so the next forced action never lands mid-reveal.

## Testing conventions and constraints

- No test in this repo (`grep` across `*.test.ts`/`*.svelte.test.ts`) asserts on
  `prefers-reduced-motion`, `matchMedia`, `getAnimations`, or `@starting-style` — CSS
  motion is a code-reviewed fact, not a jsdom-asserted one. Table.svelte's and
  HandEnd.svelte's own animations carry zero dedicated animation tests today.
- `app.ssr.test.ts`'s "claim prompt view (SSR)" describe block renders `ClaimPrompt`
  directly (`render(ClaimPrompt, {...})`), not through App's `{#key}` wrapper — unaffected
  by any change scoped to the console `{#if}` block. Its "shows no prompt at the freshly
  dealt boot" case (`render(App)`) exercises the whole tree; `{#key}` is a compile-time
  control-flow construct with no DOM node of its own, so SSR markup is unaffected by
  construction, not merely by omission of a test.
- `houtei-dismissal.tap.svelte.test.ts` drives many claim/win declines through the same
  console `{#if}` but asserts no DOM-node-identity or className fact across windows —
  unaffected by adding a key.
- `vite.config.ts`: `*.svelte.test.ts` runs under the `dom` project (jsdom,
  `resolve.conditions: ['browser']`); this ticket's own test edit lives in an existing
  file of that shape.

## Constraints carried into Design

- No core changes (`src/core/` untouched) — E-011's own scoping.
- No new runtime dependency, CSS-only motion, duration inside 150-250ms per the ticket
  text (and inside `BOT_DELAY_MS`).
- The key must be derived from `table.claimable`'s own seat+tile (the ticket's literal
  AC wording), not an incidental object identity or an unrelated counter.
- The repro suite (`claim-window-race.tap.svelte.test.ts`) is the one this ticket's AC
  names for the "remount not patch" assertion — its second `// DEFECT:` block is the one
  to flip; its first (T-011-02-01's "no outcome" scope) stays untouched.
- Given the fixture's own incidental gap (above), the remount-not-patch assertion must
  prove something the key mechanism specifically guarantees, not merely something that
  already happens to hold — `Node.isConnected` on the retained first-node reference is
  the concrete DOM fact a same-node patch would fail and a real remount satisfies.
