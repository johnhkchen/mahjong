# Review — T-012-01-02 useful-call-prompt-filter

## Summary

Implements the ticket in full: by default, a claim window whose only offers
`callPolicy` would decline no longer interrupts the player with a prompt — it
auto-passes through the existing `settleWindow` seam, exactly as if the player
had tapped "pass." A window is still shown whenever a win is offered or
`callPolicy` would accept at least one of the offered claims. A new persisted
toggle ("prompt every call" / "quiet calls," one localStorage key) restores full
prompting, live, in both terminologies.

## Files changed

**Created**
- `src/app/call-prompt-settings.svelte.ts` — the toggle module (`$state` rune +
  guarded localStorage, `dictionary.svelte.ts`'s own shape).
- `src/app/call-prompt-filter.tap.svelte.test.ts` — new end-to-end suite (5
  cases, described in progress.md).
- `docs/active/work/T-012-01-02/{research,design,structure,plan,progress,review}.md`.

**Modified**
- `src/app/drive.ts` — new `claimWindowInterrupts`; `forcedAction` gains a
  required 4th parameter and consults it.
- `src/app/dictionary.svelte.ts` — two new `TermKey` entries.
- `src/app/App.svelte` — new derived `claimsInterrupt`, filtered `prompt`, the
  `forcedAction` call's new argument, the new header button + shared CSS.
- `src/app/drive.test.ts` — 25 mechanical `forcedAction` call-site updates (add
  `, true`, preserving old semantics exactly), plus one new `describe` block (4
  cases) and one new `forcedAction` case (2 assertions).
- `src/app/app.terminology.coverage.ssr.test.ts` — two new `EXPECTED` entries
  (type-completeness only; this file's own scope explicitly excludes toggle
  click/persist behavior).
- `src/app/houtei-dismissal.tap.svelte.test.ts`,
  `src/app/window-outcome-notice.tap.svelte.test.ts` — toggle set/reset in
  `beforeEach`/`afterEach` (plus `localStorage.clear()`), one `forcedAction`
  call-site update each. No assertion changed in either file.

**Unmodified, confirmed unaffected**
- `src/app/claim-window-race.tap.svelte.test.ts` — both its windows are
  policy-approved (`callPolicy` accepts), so the new default renders them
  identically to before.
- `src/app/app.controls.svelte.test.ts`, `src/app/app.riichi.tap.svelte.test.ts`
  — neither calls `forcedAction` directly nor asserts on claim-window rendering
  in a way sensitive to the filter.

## Test coverage

- `just test`: 41 files / 969 tests green (up from 40 / 959 before this ticket;
  +10 new cases: 4 `claimWindowInterrupts`, 1 `forcedAction` filter contrast, 5
  end-to-end).
- `just check` (svelte-check + tsc): 205 files, 0 errors, 0 warnings.
- Every acceptance-criteria clause has direct coverage:
  - "never renders a prompt, play proceeds as a pass" —
    `call-prompt-filter.tap.svelte.test.ts`'s first case, ticking several bot
    turns with no prompt ever appearing and the player's own next draw still
    being reached.
  - "wins ... always prompt" — not a NEW dedicated test (the filter predicate
    never touches `winChoice`), but exercised continuously by
    `app.controls.svelte.test.ts`'s full-game `driveToHandEnd` walk, which runs
    under the DEFAULT (unmodified) toggle setting and still finds/clicks a win
    button whenever one is offered — this suite's own green run is direct
    evidence the AC holds in a real full-hand walk, not just synthetically.
  - "policy-approved claims always prompt" — the second end-to-end case
    (seed 344, reused verbatim from `claim-window-race.tap.svelte.test.ts`).
  - "toggle flips behavior live" — the third end-to-end case.
  - "survives reload" — the fifth end-to-end case (`vi.resetModules()` + fresh
    `import('./App.svelte')`).
  - "both terminologies" — the fourth end-to-end case, plus the
    `app.terminology.coverage.ssr.test.ts` type-completeness addition.
  - "extends the E-011 fixtures rather than duplicating them" — every fixture
    used (`HOUTEI_GAME_SEED`/`HAND1_SEED`/`RACE_GAME_SEED`) is a frozen constant
    copied verbatim from `houtei-dismissal.tap.svelte.test.ts` /
    `claim-window-race.tap.svelte.test.ts`; nothing was re-mined.

## Open concerns / limitations

1. **No native-speaker review of the zh-hant toggle labels.** `promptEveryCall`
   (提示每次叫牌) / `quietCalls` (安靜叫牌) are my own best-effort translations,
   carrying the same caveat T-010-01-01/02's own review docs already recorded
   for every other zh-hant string in this dictionary — worth a native check
   before shipping broadly, not blocking for this ticket's scope.
2. **No manual click-through in a real browser.** `just dev` was started and
   confirmed to serve the app shell; the actual button-renders/clicks/labels
   proof is the new `call-prompt-filter.tap.svelte.test.ts` suite (jsdom +
   fake timers), not a manual browser session. If a visual regression exists
   in real-browser rendering (unlikely — the button reuses
   `.terminology-toggle`'s exact CSS block), it wouldn't be caught here.
3. **`callPolicy`'s accept rule is a heuristic, not exhaustive** (documented in
   `policy.ts`'s own header — kuitan/yakuhai anchors only). This ticket
   deliberately reuses it verbatim ("no new legality logic," the ticket's own
   wording) — any future widening of the accept rule automatically widens what
   this filter treats as "worth a prompt," with no change needed here.
4. **Pre-existing, out-of-scope bug flagged by a sibling suite, unaffected by
   this ticket**: `window-outcome-notice.tap.svelte.test.ts`'s own header
   documents a real `src/core/legal.ts` crash (`furitenSeal`/`waits` not
   gating on `state.mustDiscard`) reachable only via a player's own successful
   claim mid-window. This ticket's filter does not touch that path (a
   policy-declined window auto-passes; it never lets the player's OWN claim
   land any differently than before), so the bug is neither introduced nor
   fixed here — carried forward as-is.
5. **`houtei-dismissal.tap.svelte.test.ts`/`window-outcome-notice.tap.svelte.test.ts`
   now depend on the toggle module being set correctly in `beforeEach`/
   `afterEach`.** If a future ticket changes the default filtered behavior
   again, these two files' `setPromptEveryLegalCall(true)` setup lines are the
   ones to revisit first — they exist SOLELY to preserve those files' original,
   unrelated assertions against this ticket's new default, not because those
   suites test the toggle themselves.

No TODOs left in the diff. No known regressions.
