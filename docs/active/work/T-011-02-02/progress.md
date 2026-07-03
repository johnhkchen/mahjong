# Progress — T-011-02-02: fresh-prompt-beat

## Completed

1. **`ClaimPrompt.svelte`** — added the CSS-only entry beat: `@media
   (prefers-reduced-motion: no-preference) { .prompt { transition: opacity/transform
   200ms ease-out; @starting-style {...} } }`, mirroring `Table.svelte`'s `.pond
   li`/`.drawn` insertion-transition shape (E-007 convention). No script/markup
   change. Verified: `npm run check` green (confirms the `@starting-style` syntax
   compiles, matching the existing Table.svelte precedent).
2. **`App.svelte`** — added `promptKey` (`$derived`, string form of `table.claimable`'s
   `{seat, tile}`, falling back to `'no-window'` for the tsumo point) and wrapped the
   console's `<ClaimPrompt>` in `{#key promptKey}...{/key}`. No prop values changed.
   Verified: `npm run check` green; full `npm test` green (39 files / 938 tests — same
   count as the pre-change baseline).
3. **`claim-window-race.tap.svelte.test.ts`** — flipped the second `// DEFECT:` block
   (the "no fresh-prompt beat" one) to a `// FIXED (T-011-02-02):` block: kept the
   existing `aria-label`/`className` equality checks (reframed as expected shared
   chrome, not a defect) and added `expect(secondPromptNode).not.toBe(firstPromptNode)`
   and `expect(firstPromptNode.isConnected).toBe(false)`. The FIRST `// DEFECT:` block
   (the "no visible outcome" one, T-011-02-01's scope) is untouched.
4. **Discriminating-test check** (plan.md Step 3's regression-guard exercise): ran the
   isolated suite three times —
   - As shipped (`{#key promptKey}`): passes.
   - With the `{#key}` wrap removed entirely: **also passes.** Confirms research.md's
     finding — this fixture's own gap (West's claim discard + North's draw + North's
     discard, three real ticks) already tears the `<ClaimPrompt>` down via the outer
     `{#if}` chain regardless of any explicit key, because `settleWindow`'s resolution
     always nulls `state.claimable` synchronously, which always empties `prompt`/`win`
     before any later discard can reopen a window.
   - With the key forced to a constant (`{#key 'x'}`): **also passes** — same reason;
     the outer `{#if}` branch is what unmounts, and a `{#key}` nested inside an
     already-destroyed branch is destroyed along with it regardless of its own value.
   - Restored `{#key promptKey}` (the correct, shipped state) before finalizing.
   - **Conclusion, carried into review.md**: the new assertions are accurate,
     forward-looking regression coverage for the architectural guarantee the AC asks
     for, but this specific fixture cannot demonstrate the guard actually *failing*
     without the key — the outer `{#if}` gap already does the job for every reachable
     window transition today (a structural consequence of `settleWindow` always nulling
     `claimable` on settle, not an accident of this one seed). Flagged honestly below
     rather than overclaiming coverage.
5. Full verification: `npm run check` (0 errors), `npm test` (39 files / 938 tests,
   green), `npm run build` (`dist/index.html` 104.8KB gzip 34.4KB, well under the
   ~300KB gate; `verify-single-file` passed).

## Deviations from the plan

- Plan Step 3's "regression-guard check" anticipated it might not cleanly discriminate
  ("whichever way Svelte's key-block reconciliation actually resolves") and that is
  exactly what happened — documented above and in review.md's open concerns, rather
  than silently dropping the check or overstating what it proves.
- No other deviation. All three files matched structure.md exactly; no additional
  files were touched.

## Concurrency note

This session ran in the same working tree as a concurrent thread on the sibling
ticket T-011-02-01 (window-outcome-notice) — both depend only on the now-`done`
T-011-01-01, so both started together per the workflow's own DAG-driven concurrency.
That thread's in-progress, uncommitted edits (`src/app/drive.ts`'s `windowOutcome`,
`src/app/dictionary.svelte.ts`'s `callTerm`, `src/app/drive.test.ts`'s new
`describe('windowOutcome')` block) were present in the working tree during this
session's `npm test`/`npm run build` runs but are **not part of this ticket's commit**
— only `src/app/App.svelte`, `src/app/ClaimPrompt.svelte`, and
`src/app/claim-window-race.tap.svelte.test.ts` (plus this ticket's own
`docs/active/work/T-011-02-02/` artifacts) are staged here. No file this ticket
touches overlaps with that thread's edits except `claim-window-race.tap.svelte.test.ts`
itself, which at commit time carried only this ticket's own edit (the second
`// DEFECT:` block) — the first block (T-011-02-01's scope) was untouched by either
thread as of this commit.

## Remaining for this ticket

Nothing — proceeding to `review.md`.
