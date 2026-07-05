# Progress — T-012-01-01 prompt-mount-input-guard

## Steps completed

1. **`src/app/mount-guard.ts` added.** Exports `MOUNT_GUARD_MS = 200` and
   `prefersReducedMotion()`. `just check` clean.
2. **`ClaimPrompt.svelte` wired.** `guarded = $state(true)` + mount `$effect`
   (`setTimeout`/`clearTimeout`, duration collapses to 0 under reduced motion); all
   three onclick handlers (`.call.win`, `.call`, `.pass`) guarded. CSS comment
   cross-references `mount-guard.ts`.
3. **`RiichiPrompt.svelte` wired.** Identical shape; both onclick handlers
   (`.declare`, `.pass`) guarded. No new CSS (none existed before — research.md).
4. **`app.riichi.tap.svelte.test.ts` updated.** Added the AC's own explicit
   interaction assertion: click inside the beat is a no-op (pond/hand unchanged,
   prompt still present), then advance `MOUNT_GUARD_MS` and the same click lands.
   Also added the advance to the "declining" test's existing click.
5. **`app.controls.svelte.test.ts` updated.** `driveToHandEnd`'s win/pass branches
   each advance `MOUNT_GUARD_MS` before clicking.
6. **`claim-window-race.tap.svelte.test.ts` updated.** One advance before the
   first window's chi click.
7. **`houtei-dismissal.tap.svelte.test.ts` updated.** `step()`'s passBtn/notYet
   branches each advance before clicking.
8. **`window-outcome-notice.tap.svelte.test.ts` updated.** `step()`'s passBtn/notYet
   branches, plus the three direct click sites (pass, tsumo win, pon), each advance
   before clicking.
9. **Full verification.** `just check` (0 errors), `just test` (40 files / 959 tests,
   all green), `just build` (single-file bundle, `verify-single-file: OK`).

## Deviations from plan.md

None. Every click site anticipated in research.md/structure.md was exactly where the
grep found it; no additional site turned up during implementation.

## What remains

Nothing for this ticket. `T-012-01-02` (the second E-012 concern — default-filtering
prompted calls to plausibly-useful ones, with a persisted toggle) is a separate
ticket, untouched here.
