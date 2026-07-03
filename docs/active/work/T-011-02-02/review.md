# Review — T-011-02-02: fresh-prompt-beat

## What changed

Three files, all in `src/app/`, no `src/core/` changes:

- **`src/app/ClaimPrompt.svelte`** (+22 lines) — one new CSS block: a `transition` +
  `@starting-style` insertion beat on `.prompt` (200ms opacity/transform fade-in),
  gated behind `@media (prefers-reduced-motion: no-preference)`. Matches
  `Table.svelte`'s own `.pond li`/`.drawn` shape (E-007's established convention) —
  same mechanism, same reasoning (client-only, SSR-untouched), same duration band. No
  script or markup change; the component's prop contract is unchanged.
- **`src/app/App.svelte`** (+15/-8 lines) — one new `$derived` (`promptKey`, a string
  built from `table.claimable`'s `{seat, tile}`, falling back to a literal for the
  tsumo point) and the console's existing `<ClaimPrompt>` element wrapped in `{#key
  promptKey}...{/key}`. Every prop passed to `ClaimPrompt` is byte-for-byte unchanged;
  only the wrapping construct is new. The `{:else if riichi}`/`{:else if hint}`
  branches are untouched.
- **`src/app/claim-window-race.tap.svelte.test.ts`** (+13/-5 lines) — the second
  `// DEFECT:` block (T-011-01-01's "no fresh-prompt beat" marker) is flipped to a
  `// FIXED (T-011-02-02):` block. The existing `aria-label`/`className` equality
  checks are kept (reframed as expected shared chrome for two same-call-type windows,
  not a defect) and two new assertions are added: `secondPromptNode !==
  firstPromptNode` and `firstPromptNode.isConnected === false`. The file's FIRST
  `// DEFECT:` block (the "no visible outcome" one — T-011-02-01's scope) is untouched.

Four docs artifacts (research/design/structure/plan) plus this review and
`progress.md` under `docs/active/work/T-011-02-02/`.

## Test coverage

- `claim-window-race.tap.svelte.test.ts`'s one `it` now additionally asserts the DOM
  fact that distinguishes a genuine remount from a same-node patch:
  `firstPromptNode.isConnected` reads `false` after the second window opens (the
  original `<aside>` was actually detached, not merely relabeled) and
  `secondPromptNode` is a different object reference. `npm run check` (svelte-check +
  tsc, 200 files, 0 errors) and `npm test` (39 files / 938 tests) are both green —
  identical file/test counts to T-011-01-01's own baseline, confirming nothing else
  moved. `npm run build` succeeds (`dist/index.html` 104.8KB / gzip 34.4KB, well under
  the ~300KB single-file gate; `verify-single-file` passes).
- No unit-level (pure-function) test is added — nothing in `src/core/` or `drive.ts`
  changed; this is entirely a presentation-layer change (CSS + template keying) plus
  one interaction-suite assertion, matching the ticket's own view/drive-only scope.

### Gaps

- **The CSS motion itself is untested.** No jsdom assertion checks that the
  `@starting-style` transition actually fires, that its duration is 200ms, or that the
  `prefers-reduced-motion` media query actually suppresses it. This is NOT a new gap
  this ticket introduces — `grep` across every `*.test.ts`/`*.svelte.test.ts` in this
  repo (research.md) found zero precedent for testing `prefers-reduced-motion`,
  `matchMedia`, `getAnimations`, or `@starting-style` behavior anywhere, including
  `Table.svelte`'s and `HandEnd.svelte`'s own existing motion. The AC's "entry
  transition exists and is disabled under prefers-reduced-motion" is satisfied by the
  `@media` gate being present in the stylesheet — a code-reviewable fact, held to the
  same standard every prior E-007 motion addition was held to.
- **The new "remount not patch" assertions do not currently discriminate a working key
  from a missing one, on this specific fixture — verified empirically, not assumed.**
  Before finalizing, I ran the isolated test three ways: with the real `{#key
  promptKey}`, with the `{#key}` wrap removed entirely, and with the key forced to a
  constant (`{#key 'x'}`). **All three pass.** The reason: `settleWindow`'s resolution
  always nulls `state.claimable` synchronously when a window settles, which always
  empties `prompt`/`win` in the same tick — before any later discard can reopen a
  window. That means the OUTER `{#if (prompt.length > 0 || win !== null) &&
  !dismissed}` chain already tears the whole branch (and anything keyed inside it)
  down on every window-to-window transition, independent of the `{#key}`'s own value.
  Given this, I could not construct (and current architecture may not permit
  constructing) a fixture where the outer condition stays continuously true across two
  different windows — the one scenario where a missing/wrong key would actually cause
  an observable patch instead of a remount. The `{#key}` remains correct, precedented
  (E-007), and directly responsive to the AC's literal wording ("keyed per window
  (claimable seat+tile)") — it is defensive architecture against a future change that
  altered `settleWindow`'s null-out timing, not a guard this ticket's own test can
  prove is load-bearing today. I chose to ship the assertions anyway (they are
  accurate, forward-looking regression coverage) and disclose this honestly rather
  than either dropping them or overclaiming what they catch.
- No terminology-toggle coverage was added or needed — this ticket introduces zero new
  user-facing strings (the CSS class names and key expression carry no display text).

## Open concerns for a human reviewer

1. **The discriminating-test gap above.** If a reviewer wants a fixture that actually
   fails without the key, one would need a scenario where two structurally different
   windows are both live within a single continuous span of the outer `{#if}`
   condition — given `settleWindow`'s current architecture (always nulls `claimable`
   on settle), I don't believe this is reachable today. Worth a second look if
   `settleWindow`'s null-out behavior ever changes.
2. **`promptKey`'s fallback for the no-claimable case (`'no-window'`).** This only
   covers the tsumo point today (the one player-decision moment with no discard behind
   it). If a future ticket adds another no-claimable console moment that CAN recur
   within one hand, it would silently share this same constant key and NOT get a fresh
   remount — worth revisiting `promptKey`'s derivation if that ever becomes true. Not a
   risk today: tsumo ends the hand immediately.
3. **Ran in a shared working tree with a concurrent thread on T-011-02-01** (the
   sibling "window-outcome-notice" ticket, same story, same `depends_on:
   [T-011-01-01]`). That thread's in-progress `drive.ts`/`dictionary.svelte.ts`/
   `drive.test.ts` edits were present during this session's `npm test`/`npm run build`
   runs but are explicitly NOT part of this ticket's commits — verify at merge time
   that both tickets' edits to the shared `claim-window-race.tap.svelte.test.ts` file
   (T-011-02-01 owns the FIRST `// DEFECT:` block, this ticket owns the SECOND) compose
   cleanly; they touch disjoint line ranges as of this review but were authored
   concurrently by separate sessions.

## Nothing critical is outstanding

No TODOs, no `.skip`/`.todo`, no known-failing assertions. `npm run check`, `npm test`,
and `npm run build` are all green. The ticket's single Acceptance Criterion is met: the
prompt is keyed on window identity (a new claimable discard remounts it — verified via
`isConnected`), the entry transition exists and is CSS-gated under
`prefers-reduced-motion`, the repro suite's consecutive-window sequence asserts
remount semantics (with the honest caveat in Gaps/Open-concerns above about what that
assertion can and cannot currently discriminate), and SSR output is unchanged (the
existing `app.ssr.test.ts` suite — including its "claim prompt view" and "shows no
prompt at the freshly dealt boot" cases — passes unmodified, and `{#key}` is a
compile-time control-flow construct with no DOM node of its own).
