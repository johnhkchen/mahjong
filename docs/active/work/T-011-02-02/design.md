# Design — T-011-02-02: fresh-prompt-beat

## Decision summary

Two small, additive changes, no core changes: (1) `App.svelte` wraps the console's
`<ClaimPrompt>` in `{#key promptKey}`, where `promptKey` is a string derived from
`table.claimable`'s own `{seat, tile}` (falling back to a stable literal when no window
is open); (2) `ClaimPrompt.svelte` gains one `@starting-style`-based insertion
transition (E-007's own precedent, `Table.svelte`'s `.pond li`/`.drawn` shape), 200ms,
gated behind `@media (prefers-reduced-motion: no-preference)`. The repro suite's second
`// DEFECT:` block (the "no fresh-prompt beat" one) flips to asserting the DOM fact the
key specifically guarantees: the prior prompt node is actually disconnected
(`isConnected === false`) and the new one is a different reference, not merely a
same-node patch.

## Option space for the keying mechanism

### Option 1 — `{#key}` block around `<ClaimPrompt>`, keyed on `` `${seat}:${tile}` ``
**Chosen.** Directly matches the AC's own vocabulary ("keyed per window (claimable
seat+tile)"). `{#key}` is Svelte's purpose-built primitive for "destroy and recreate
this subtree whenever this expression's value changes" — exactly the "never patch"
guarantee the AC asks for, and it composes cleanly with the existing `{#if}`/`{:else
if}` chain (it wraps only the one branch's content; the `{:else if}` siblings are
untouched). Because the key is a derived string (not an object), it stays referentially
stable across incidental re-folds where `table` is a fresh object but `claimable`'s
seat+tile are unchanged — no spurious remounts while one window is genuinely still
open and nothing else has changed.

### Option 2 — rely on the `{#if}` chain's existing incidental churn
Rejected. Research confirms the *tested* race fixture already produces a real gap
(`claimPrompt(target)` returns `null` between windows), but nothing in `App.svelte`
guarantees this in general — the gap is a byproduct of forced bot ticks always
intervening, not an architectural fact. A future change that removed an intervening
tick (e.g., collapsing a claim's resolution and the next discard into one push) could
make two different windows land inside one continuously-true span of the `{#if}`
condition, at which point Svelte would patch the mounted `ClaimPrompt`'s props in place
instead of remounting — silently reintroducing exactly the "same node, same beat-free
render" defect this ticket exists to close. The AC's explicit ask for keying is
precisely to remove this fragility, not to certify today's incidental behavior.

### Option 3 — key on `table` (the whole derived record) or on `offered` (the legal-actions array)
Rejected. Both are new object references on every re-fold regardless of whether the
window identity actually changed (e.g., a furiten seal flipping elsewhere on the table
re-derives `table` without touching `claimable`). Keying on either would remount the
prompt — restarting the entry beat — on unrelated state changes, which reads as
jitter, not a "fresh window" signal. The AC is specific about window identity being
"(claimable seat+tile)"; a coarser key over-triggers, a finer one (see Option 4)
under-specifies.

### Option 4 — key on `table.claimable` object identity directly (no string derivation)
Considered. `table.claimable` is already `{seat, tile} | null` — passing the object
itself to `{#key}` would work today, since `foldGame` only produces a new `claimable`
object when the fold actually re-runs from a new action, and nothing re-derives it
mid-window (no action is pushed while a window is open — the loop pauses). Rejected in
favor of Option 1 anyway: an explicit string makes the identity fact legible at the call
site (matches the AC's own "(claimable seat+tile)" phrasing rather than an opaque object
reference) and is immune if a future refactor ever made `foldGame` return a
stably-memoized-but-differently-shaped `claimable` record for the same logical window
(defensive, costs nothing).

## Option space for the entry motion

### Option 1 — `transition + @starting-style` on `.prompt` (insertion-transition shape)
**Chosen.** This is a genuine DOM insertion (a fresh `<aside class="prompt">` mounts
every time the key changes) — the exact case Table.svelte's own comment names
this pattern for ("insertion transitions via `@starting-style`"). 200ms opacity +
translateY fade, matching `.pond li`/`.drawn`'s own two-property shape, sits inside the
150-250ms band the ticket names and inside `BOT_DELAY_MS` (250ms) so the beat finishes
before the next forced tick could land.

### Option 2 — `animation: name Xms ease-out` (state-change/keyframe shape)
Rejected for this element specifically: Table.svelte reserves this shape for elements
that are recreated as a *side effect* of a state change on an otherwise-continuous list
(a meld li appended to a growing `{#each}`, a claimed pond `li`'s branch swap) — cases
where "the branch swap recreates the element" is a means to an end, not the point.
Here, the `{#key}`-driven remount IS the point (the explicit AC ask), so the
insertion-transition framing fits the intent more directly. Either shape would satisfy
the AC's plain "entry transition" wording; Option 1 was chosen for the closer semantic
match, not because Option 2 would fail.

### Option 3 — a new runtime dependency (Svelte's `svelte/transition` `fly`/`fade`, or an animation library)
Rejected outright: E-011's own context section says "no new dependencies; CSS-only
motion per E-007 conventions" verbatim, and Table.svelte's own comment explains this
codebase already deliberately avoids Svelte's built-in `transition:` directive in favor
of CSS `@starting-style` specifically because directives are client-only in a way that
CSS is not (no special-casing needed for SSR — the markup is identical either way).

## What "keyed per window" does NOT need to solve

- No new outcome/notice text — that is T-011-02-01's scope (a different `console`
  branch concern, a different DEFECT block in the same test file).
- No terminology-toggle coverage — this ticket introduces no new user-facing string;
  the CSS motion class names and the key expression carry no display text.
- No change to `settleWindow`/`promptChoices`/`winChoice` or any core file — the window
  IS still exactly what `table.claimable`/`offered` already say it is; this ticket only
  changes how the console *presents* a change in that fact.

## Test strategy: what "asserts remount (not patch) semantics" means here

Because the tested fixture's gap already produces DOM churn incidentally (Research),
`toBe`/`not.toBe` equality on freshly-queried node references would pass even without
the fix — a weak regression guard. The chosen assertion instead targets the DOM fact
that specifically distinguishes a patch from a remount regardless of any incidental
gap: **the original node's `isConnected` flag**. A same-node patch leaves the original
`<aside>` attached (its attributes/children update in place); a genuine remount detaches
it entirely before a new one is created. Asserting `firstPromptNode.isConnected ===
false` alongside `secondPromptNode !== firstPromptNode` pins the actual guarantee the
`{#key}` mechanism provides, not an accident of this fixture's timing. `aria-label`/
`className` equality (already asserted, now reframed from DEFECT to expected-shared
chrome) stays — the two windows are legitimately the same call type here, and that is
not itself a defect once the beat and remount guarantee exist.

No jsdom assertion is added for the CSS motion itself (animation timing,
`prefers-reduced-motion`) — no precedent exists anywhere in this repo for testing that
layer (Research), and inventing one here would be new-pattern scope beyond this
ticket's ask. The AC's "disabled under prefers-reduced-motion" is satisfied by the
`@media` gate itself, verifiable by reading the stylesheet — the same standard every
prior E-007 motion addition was held to.
