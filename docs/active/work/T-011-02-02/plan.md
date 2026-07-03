# Plan — T-011-02-02: fresh-prompt-beat

## Step 1 — Add the entry transition to `ClaimPrompt.svelte`

Append the `@media (prefers-reduced-motion: no-preference)` block (structure.md) inside
the existing `<style>` element. No script/markup change.

**Verification**: `npm run check` (svelte-check + tsc) stays green — confirms the CSS
parses (this repo's own `@starting-style` precedent already proves Svelte's compiler
accepts the syntax, but checking after every edit catches typos immediately rather than
bundling failures into a later step). `npm test` (full suite) stays green — no test
touches this file's `<style>` content, so this step alone should not change any test
outcome; a green run here isolates the change as presentation-only before Step 2 adds
any behavioral surface.

## Step 2 — Key the console's `ClaimPrompt` in `App.svelte`

Add the `promptKey` `$derived` binding and wrap the existing `<ClaimPrompt>` element in
`{#key promptKey}...{/key}` (structure.md). No prop values change.

**Verification**: `npm run check` stays green (type-checks the new derived binding).
`npm test` (full suite) — expect ALL existing suites to stay green, INCLUDING
`claim-window-race.tap.svelte.test.ts` and `houtei-dismissal.tap.svelte.test.ts` in
their current (pre-Step-3) form: adding a key that matches the window's already-unique
identity should not change any currently-passing assertion, since no test today
depends on cross-window DOM-node identity being shared (research.md confirmed neither
suite makes that assertion). If anything in `app.ssr.test.ts` broke here, that would
mean `{#key}` altered SSR markup — investigate immediately, do not proceed to Step 3
with a red suite.

## Step 3 — Flip the repro suite's "no fresh-prompt beat" assertion

Edit the second `// DEFECT:` block in `claim-window-race.tap.svelte.test.ts`
(structure.md): reframe the comment, keep the two existing `toBe` checks, add
`not.toBe(firstPromptNode)` and `firstPromptNode.isConnected` checks.

**Verification**: `vitest run src/app/claim-window-race.tap.svelte.test.ts` in
isolation, green. This is the step that actually exercises whether Steps 1-2 delivered
the guarantee the AC asks for — if `isConnected` were `true` here (i.e., if Svelte had
somehow patched rather than remounted despite the key), this is where it would be
caught.

**Regression-guard check (mirrors T-011-01-01's own discipline)**: temporarily comment
out the `{#key promptKey}`/`{/key}` wrap in `App.svelte` (leaving the bare
`<ClaimPrompt>`), re-run this one test file, and confirm it still passes — this is the
expected (if slightly unsatisfying) result given research.md's finding that this
specific fixture's gap already produces incidental remounts. Then intentionally
falsify a strictly-tighter check to confirm the test CAN fail: temporarily replace the
key expression with a constant (e.g. `{#key 'x'}`) — this forces the SAME key across
both windows — re-run, and confirm `isConnected` now reads `true` for the first node OR
the two node references become equal (whichever way Svelte's key-block reconciliation
actually resolves an unchanged key across a re-render). Restore the real
`promptKey` expression before finalizing. This substitutes for a "revert the fix"
exercise (there is no separate defect commit to revert here) and proves the assertion
is discriminating, not vacuously true.

## Step 4 — Full-suite and build verification

Run the complete gate: `npm run check`, `npm test` (all files), and confirm `dist/`
still builds (`npm run build`) even though the AC does not name the size gate
explicitly for this ticket (T-011-02-03 owns that final check) — cheap to confirm now
and avoids surprising the closing ticket.

**Verification**: all three commands exit 0. Specifically re-read `app.ssr.test.ts`'s
"claim prompt view (SSR)" and "shows no prompt at the freshly dealt boot" cases in the
green output — the AC's "SSR output unchanged" clause is this file's own existing
coverage; no new SSR assertion is being added because none of this ticket's changes
touch SSR-visible markup (structure.md), so the correct verification is that the
existing suite continues to pass unmodified.

## Step 5 — Commit

One commit for the whole ticket (three files, one cohesive change — no natural split
point the way T-011-01-01 had two independent fixtures). Write `progress.md`
immediately after, `review.md` last.

## Testing strategy (summary)

| What | How | Why this level |
|---|---|---|
| CSS motion exists and is reduced-motion-gated | Code review of the `@media` block | No precedent anywhere in this repo for jsdom-asserting animation/`@starting-style` behavior (research.md) |
| Window keying causes remount, not patch | jsdom, DOM node `isConnected` + reference inequality, in the existing mounted-`App` fixture | The only DOM-observable fact that distinguishes a patch from a remount regardless of incidental timing gaps |
| The assertion is discriminating (not vacuous) | Temporarily collapse the key to a constant, confirm the new assertion fails, then restore | Mirrors T-011-01-01's own "prove it's a real guard" discipline, adapted since there is no separate defect commit to revert |
| Nothing else moved | Full `npm test` + `npm run check` + `npm run build` | Three small, additive edits touching an existing render path — cheapest way to catch an unintended interaction |

No unit-level (pure-function) tests are added — nothing in `src/core/` or `drive.ts`
changes. Everything here is CSS/template presentation plus one interaction-suite
assertion, matching the ticket's own view/drive-only scope.
