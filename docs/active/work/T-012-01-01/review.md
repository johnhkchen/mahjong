# Review — T-012-01-01 prompt-mount-input-guard

## Summary

A freshly-mounted `ClaimPrompt`/`RiichiPrompt` now ignores button activations for one
"mount-guard" beat (200ms, collapsing to 0 under `prefers-reduced-motion`), so a tap
mistimed against a just-closed prompt can no longer land on the very next one's
buttons. Buttons render identically either way — the guard is presentation-only, no
`disabled`, no visual change — only the click handler no-ops while guarded.

## Files changed

**New:**
- `src/app/mount-guard.ts` — `MOUNT_GUARD_MS = 200` and `prefersReducedMotion()`,
  shared by both prompt components so their durations can't drift apart.

**Modified (production):**
- `src/app/ClaimPrompt.svelte` — `guarded` state + mount effect; all three onclick
  handlers (win, call, pass) gated; CSS comment now cross-references
  `mount-guard.ts`.
- `src/app/RiichiPrompt.svelte` — same shape; both onclick handlers (declare,
  decline) gated. No new CSS entry transition added (none existed before this
  ticket; adding one was out of scope — a visual-only change nothing here requested).

**Modified (tests, all insertions — no assertion loosened or removed):**
- `src/app/app.riichi.tap.svelte.test.ts` — added the ticket's own explicit
  interaction proof (click inside the beat is inert; the same click after the beat
  lands) plus one advance in the decline-path test.
- `src/app/app.controls.svelte.test.ts` — two advances inside `driveToHandEnd`
  (win/pass branches).
- `src/app/claim-window-race.tap.svelte.test.ts` — one advance before the raced
  window's chi click.
- `src/app/houtei-dismissal.tap.svelte.test.ts` — two advances inside `step()`
  (pass/riichi-decline branches).
- `src/app/window-outcome-notice.tap.svelte.test.ts` — two advances inside its own
  `step()` plus three advances at direct click sites (pass, tsumo win, pon).

## Test coverage

- **Direct AC coverage**: `app.riichi.tap.svelte.test.ts`'s first test now asserts,
  against a real mounted App, that (a) a click inside the guard beat does nothing —
  no pond change, prompt still showing — and (b) the identical click after advancing
  `MOUNT_GUARD_MS` lands normally. This is the concrete "activation inside the beat
  does nothing; the same activation after the beat works" the AC calls for.
- **Win-button parity**: `window-outcome-notice.tap.svelte.test.ts`'s tsumo case
  exercises `.call.win` through the same guard/advance pattern as every other
  button — no special-cased shorter/longer duration exists in the implementation
  (Decision 5, design.md), so "the win button obeys the same beat and no more" is
  true by construction, not just by this one test.
- **Regression breadth**: five existing E-011 suites (window race/reopen, notice
  cascade across pass/tsumo/pon-vs-ron, houtei dismissal reset, generic
  drive-to-hand-end across arbitrary seeds) all continue to pass with the guard
  live, each having needed only an inserted timer advance, never a weakened
  assertion — confirmed by reading every diff hunk in those five files before this
  writeup (each hunk is purely additive: a `vi.advanceTimersByTimeAsync` +
  `flushSync` pair, nothing removed).
- **Full suite**: `just test` — 40 files, 959 tests, all green. `just check` — 203
  files, 0 errors/warnings. `just build` — single-file bundle produced,
  `verify-single-file: OK`.
- **Gap, not a regression**: no test exercises the `prefersReducedMotion() === true`
  branch (jsdom's `matchMedia` stub always reports `matches: false`; no suite
  overrides it). This was scoped out in plan.md up front — no AC asks for it, and
  simulating a `matchMedia` override across a real-App-mounted suite would be new
  test infrastructure this ticket doesn't need. The reduced-motion path is a single
  ternary (`prefersReducedMotion() ? 0 : MOUNT_GUARD_MS`) reusing a function whose
  only branch is a `typeof`/`.matches` read — low-risk to leave unverified by an
  automated test, but worth a human eyeballing `mount-guard.ts` directly since it's
  the one piece of new logic with no test touching its `true` branch at all.

## Open concerns / known limitations

1. **RiichiPrompt gained a JS guard but no new CSS entry beat.** The ticket's
   Context describes RiichiPrompt as already having "the existing CSS transition
   duration" the way ClaimPrompt does; research.md found RiichiPrompt has no CSS
   transition at all. I implemented the JS guard anyway (using the same shared
   200ms constant) since the ticket names RiichiPrompt as in-scope, but did NOT add
   a new `@starting-style`/`transition` block to RiichiPrompt — that would be a
   visual change no AC or epic line requests, and inventing one wasn't this
   ticket's call to make silently. If the owner intended RiichiPrompt to get a
   matching visual beat too, that's a follow-up (or a note for T-012-01-02/a future
   ticket), not something folded in here.
2. **Pre-existing out-of-scope bug, not touched**: `window-outcome-notice.tap.svelte.test.ts`'s
   own header comment documents a real `src/core/legal.ts` crash
   (`furitenSeal`/`waits` throwing `RangeError` on a player's own successful
   claim) discovered while mining that file's fixtures — flagged there already as
   out of E-011's scope; still out of this ticket's scope too (view/drive-only per
   E-012). Noted here only so it isn't lost between epics.
3. **No dedicated unit test for `mount-guard.ts`** — deliberate (plan.md Testing
   strategy): the module has no branching complex enough to warrant isolation
   separate from the two components that already exercise its "motion allowed"
   path end to end.

## For the human reviewer

The diff is small and mechanical: one new 12-line file, two components each gaining
one `$state` + one `$effect` + inline guard checks on existing onclick lambdas, and
five test files each gaining a handful of `advanceTimersByTimeAsync`/`flushSync`
pairs at click sites a grep enumerated exhaustively (research.md's audit). The one
judgment call worth double-checking is open concern #1 above — whether RiichiPrompt
needed only the input guard (what shipped) or also a new visual beat to match.
