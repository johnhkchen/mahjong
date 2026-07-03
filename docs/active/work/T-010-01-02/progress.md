# Progress — T-010-01-02 toggle-and-persistence

## Deviation from plan.md, found during Step 1

The guard shape in research.md/design.md/plan.md was `typeof localStorage !== 'undefined'`.
While implementing Step 1, running the full suite showed this literally works (returns
`'undefined'` correctly under the Node project) but **emits a Node
`ExperimentalWarning: localStorage is not available because --localstorage-file was not
provided`** on every touch, including a bare `typeof` check — Node 20+'s built-in `localStorage`
is an accessor property, and `typeof x.y` still invokes `y`'s getter. This directly violated the
AC's "without warnings" wording, so before committing:

1. Changed the guard to `typeof window === 'undefined'` (true only in the Node project; never
   touches the `localStorage` accessor at all when absent) — `dictionary.svelte.ts` now reads/
   writes via `window.localStorage`, not a bare `localStorage` reference.
2. Discovered a second, related issue this surfaced: in the `dom` (jsdom) Vitest project,
   `window.localStorage` was ALSO Node's broken accessor, not jsdom's real `Storage` — Vitest's
   jsdom environment setup skips copying any window property already present as an own property
   of `global`, and Node's `localStorage` is exactly that. Fixed with a new
   `src/app/vitest-dom-setup.ts` (a small in-memory `Storage` polyfill) wired into
   `vite.config.ts`'s `dom` project via `test.setupFiles`. See structure.md's two new sections
   for the full rationale; this is a Node/jsdom/Vitest version-interaction test-infra gap, not a
   production concern (real browsers ship working `localStorage`).

Confirmed via `npx vitest run` (multiple repeated runs, full suite) both that this fix resolves
the warning/crash and that it doesn't mask a real problem — a throwaway one-off test file
(`ls-check.svelte.test.ts`, deleted before committing) reproduced and confirmed each hypothesis
before the fix landed, per plan.md Step 1's own instruction to verify claims empirically rather
than trust them secondhand.

Also noted: one `app.controls.svelte.test.ts` failure ("resets scores to 25000...", expected
100000 got 99000) appeared once during a full-suite run early in Step 1, before any of the above
fixes were in place. Re-ran the full suite three more times after the fixes (and once against
`git stash`ed pre-ticket code) — never reproduced. Concluded this was an unrelated one-off flake,
not a regression introduced by this ticket. Not chased further since it did not reproduce.

## Step 1 — `dictionary.svelte.ts` guarded persistence

Done. `STORAGE_KEY`, `isTerminology`, `loadStored()` added; `current` seeded from `loadStored()`;
`setTerminology()` persists. Guard shape corrected per the deviation above before commit. Doc
comments updated to present tense. `vitest-dom-setup.ts` + `vite.config.ts` added alongside (the
deviation's second fix). Full suite green (903/903, repeated runs, no warnings). `just check`
clean.

## Step 2 — `App.svelte` toggle control

Done. `TERMINOLOGY_LABEL`, `otherTerminology`, `toggleTerminology` added; header gains the
second button; `.new-game`/`.terminology-toggle` share their CSS via a comma-selector (design.md
Decision 3 — no shared class name). `just check` clean, full suite green (903/903).

Manual browser verification (no project run-skill existed, so used the `run` skill's
browser-driven fallback — Playwright against `just dev`'s server, headless Chromium, 390×844
viewport): confirmed the toggle renders beside "new game" at identical visual weight (screenshot
diffed by eye); clicking it relabels every wind name live (`East/South/West/North` →
`東/南/西/北`) with the button itself flipping to name the OTHER terminology
(`中文` → `romaji`); the dealt hand's 13 tiles are unchanged before/after; the choice writes to
exactly the `mahjong-terminology` localStorage key; a real page reload (not just a module reset)
still shows `zh-hant`; a second click reverts everything; zero console warnings/errors captured
during the whole run. Screenshots and the driver script were scratch artifacts, not committed.
