# Design — T-012-01-01 prompt-mount-input-guard

## Decision 1 — where the guard state lives: per-component, not shared/module-scoped

**Chosen:** each of `ClaimPrompt.svelte`/`RiichiPrompt.svelte` owns its own
`guarded = $state(true)` plus its own mount `$effect` that clears it after a duration.

**Rejected: a shared reactive store (e.g. a `.svelte.ts` module exporting a
`createMountGuard()` rune-based factory).** Both prompts genuinely need independent,
per-mount-instance state — a module-scoped `$state` (the pattern `dictionary.svelte.ts`
uses for `activeTerminology`) is wrong here because that state is deliberately
*singleton*-shared across every consumer, whereas guard state must reset per mount and
never leak between ClaimPrompt and RiichiPrompt or between two ClaimPrompt mounts. A
factory function returning a fresh reactive object per call is a real Svelte 5 idiom,
but it buys nothing here — the guard logic is four lines (one `$state`, one `$effect`)
and needing it in two files is not the kind of duplication this codebase abstracts
away (see Decision 2). Introducing a factory would also require a new `.svelte.ts`
file with no other precedent for anything this small.

## Decision 2 — the constant: extracted, not duplicated

**Chosen:** a tiny new module, `src/app/mount-guard.ts`, exporting:
- `export const MOUNT_GUARD_MS = 200`
- `export function prefersReducedMotion(): boolean`

Both `ClaimPrompt.svelte` and `RiichiPrompt.svelte` import both. Test files that need
to advance fake timers past the guard duplicate the numeric literal locally as
`MOUNT_GUARD_MS = 200`, following the codebase's own `BOT_DELAY_MS` convention (a
production-code constant re-declared in test files with a cross-referencing comment,
never imported) — production code and test code use different sourcing strategies on
purpose, and that split is already established.

**Rejected: duplicate `const MOUNT_GUARD_MS = 200` independently inside each of
ClaimPrompt.svelte and RiichiPrompt.svelte, matching the BOT_DELAY_MS test-duplication
convention exactly.** The ticket's own Context is explicit: "keep them one constant."
That phrase is about not letting the CSS beat duration and the JS guard duration drift
apart *for a given component* — but since the SAME literal (200) also needs to be
identical *across* ClaimPrompt and RiichiPrompt (RiichiPrompt has no independent beat
of its own to derive its number from — see research.md), a single exported constant is
the only way to guarantee neither file can drift from the other or from ClaimPrompt's
CSS value without the compiler/reviewer noticing. The BOT_DELAY_MS convention
duplicates a *production-to-test* boundary (App.svelte's own internal constant,
re-declared in tests that can't import Svelte component internals); this is a
*production-to-production* boundary (two sibling `.svelte` files), where a plain
shared `.ts` import is the ordinary, unremarkable answer — Svelte components already
freely import shared TS modules (`dictionary.svelte.ts`, `drive.ts`, `../core`).

**Rejected: keep the constant only in ClaimPrompt.svelte's CSS as a raw `200ms`, with
RiichiPrompt hardcoding `200` independently with a comment pointing at ClaimPrompt.**
CSS custom properties can't be shared with JS without a build step change (out of
scope: "no new dependencies," and this ticket doesn't touch `vite.config.ts` or
introduce CSS variables project-wide); a plain exported JS constant is the simplest
thing that actually prevents drift.

## Decision 3 — reduced motion: JS-side `matchMedia` check, evaluated at guard-start time

**Chosen:** `prefersReducedMotion()` in `mount-guard.ts`:
```ts
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
```
Each component's mount effect computes `const duration = prefersReducedMotion() ? 0 : MOUNT_GUARD_MS`
once, at mount, and schedules the `setTimeout` with that duration. This exactly mirrors
the CSS side: the `@media (prefers-reduced-motion: no-preference)` block is the only
place the transition/`@starting-style` rule exists at all, so under `reduce` the CSS
beat is already zero-length (no transition, no starting-style delta) — the JS guard
matching with `duration = 0` (i.e., the `guarded` flag clears on the next microtask/tick
rather than after 200ms) keeps the two "collapse together," per the ticket's own
wording.

**Rejected: gate via a CSS custom property read from `getComputedStyle` (e.g. read the
actual `transition-duration` off the mounted `.prompt` node and use that as the guard's
timeout).** This inverts the dependency for no benefit — it requires the component to
mount, layout, and read back computed style before it can even start its own timer,
adds a real DOM read most jsdom test environments handle inconsistently, and produces
the same 0/200 answer `matchMedia` gives directly and synchronously. Rejected as
needless indirection.

**Rejected: only check `matchMedia` once at module load / cache the result.** A media
query can change during a session (OS-level `prefers-reduced-motion` toggle, or a test
suite that flips it between cases) — re-checking at every mount is one function call
and keeps each mount correct for whatever the setting is *at that mount*, matching how
the CSS `@media` block itself is re-evaluated live by the browser on every affected
render, not cached from page load.

## Decision 4 — guard mechanism: no-op the callback in the handler, not `disabled`

**Chosen:** wrap each button's existing `onclick` inline lambda with a `guarded` check,
e.g. `onclick={() => { if (!guarded) onwin?.() }}`. No `disabled` attribute, no class
change, no visual difference during the guard window.

**Rejected: `disabled={guarded}` on every button.** Directly contradicted by the
ticket's own Context: "Guard is presentation-only: the buttons render immediately,
activations inside the beat are inert." A `disabled` button typically gets
browser/UA default dimming and drops out of the tab order — an observable appearance
and accessibility change the ticket explicitly rules out. The requirement is
specifically silent inertness, not a disabled affordance.

**Rejected: a capture-phase event listener on the `<aside>` root that
`stopPropagation`s/`preventDefault`s all clicks during the guard window.** Functionally
equivalent to the per-button check but adds an imperative `$effect`-installed DOM
listener (`addEventListener`/`removeEventListener` lifecycle, capture flag) for
something four inline one-line guards already solve declaratively with plain reactive
Svelte. Also more surprising to a future reader: input handling for a Svelte component
built entirely from prop-driven `onclick` callbacks (see both components' existing
code) should stay in that same idiom, not introduce a second, DOM-imperative one
alongside it.

## Decision 5 — win button gets no special-cased duration

Per E-012's own constraint ("the guard must not delay the win button's availability
beyond the beat") and AC's "the win button obeys the same beat and no more": `.call.win`
uses the exact same `guarded` flag and the exact same `onclick={() => { if (!guarded)
onwin?.() }}` wrapper as every other button in ClaimPrompt — no separate constant, no
earlier-clearing special case. This is the simplest option and is exactly what both
the ticket and epic ask for; no alternative was seriously considered.

## Decision 6 — test suites: advance real (fake-timer) time past the guard, never weaken assertions

Chosen, and the only option consistent with the AC's explicit instruction: every
click-site enumerated in research.md gets `await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)`
+ `flushSync()` inserted immediately before the click (mirroring the existing
`BOT_DELAY_MS` tick-advance idiom already used throughout these files). This is
authored as the natural reading of "advance past the beat" and is not a tradeoff
decision — no alternative (weakening the click assertions, disabling the guard under
test, mocking `prefersReducedMotion` to skip it) is compatible with the AC as written,
so none are explored further here.
