# Review — T-010-01-02 toggle-and-persistence

## What changed

**Modified:**
- `src/app/dictionary.svelte.ts` — `current`'s `$state` initializer now reads a persisted
  terminology at module load (`loadStored()`), and `setTerminology()` now also writes it
  (`STORAGE_KEY = 'mahjong-terminology'`). Both are guarded on `typeof window === 'undefined'`,
  not `typeof localStorage === 'undefined'` (see "Deviations" below for why). A malformed or
  foreign stored value falls back to `'romaji'` via a type guard (`isTerminology`), never
  throwing. Two doc comments updated from "future toggle" to present tense, since this ticket is
  that toggle.
- `src/app/App.svelte` — the header gains a second `<button class="terminology-toggle">` beside
  `.new-game`, wired to a new `toggleTerminology()` that flips `activeTerminology()` through
  `setTerminology()`. The button's text and `aria-label` always name the terminology a tap
  switches TO (e.g. shows "中文" while `romaji` is active, "romaji" while `zh-hant` is active) via
  a small local `TERMINOLOGY_LABEL` map — deliberately not added to `dictionary.svelte.ts`'s
  `TERMS` table, since a terminology's own name isn't itself a translatable game term. CSS:
  `.new-game`'s ruleset widened to a comma-selector shared with `.terminology-toggle` (same
  declarations, same ≥44px target), rather than sharing the `.new-game` class name itself, so
  `.new-game`'s existing meaning ("the new-game button") and every test that selects on it stay
  unambiguous.
- `src/app/app.ssr.test.ts` — one new `describe` block asserting the Node/SSR render path shows
  the default terminology and never calls `console.warn`/`console.error`.
- `vite.config.ts` — the `dom` Vitest project gains `test.setupFiles: ['./src/app/vitest-dom-setup.ts']`.

**Created:**
- `src/app/app.terminology.svelte.test.ts` — 8 tests covering the toggle's own contract: live
  relabeling, the toggle button naming the destination terminology, the running hand staying
  undisturbed, toggling back, writing exactly one storage key, and three "simulated reload"
  scenarios (persisted value read at boot, absent key defaults, malformed value falls back).
- `src/app/vitest-dom-setup.ts` — a small in-memory `Storage` polyfill, wired into the `dom`
  Vitest project only. Not part of the original plan; see "Deviations."

**Untouched:** every other file in `src/app/` and all of `src/core/` — no consumer of
`dictionary.svelte.ts`'s existing exports needed a signature change, confirming T-010-01-01's own
design bet (its top-of-file comment named this exact outcome as the reason for a module-scoped
rune).

## Deviations from plan.md, both found empirically during Step 1, both fixed before their commit

1. **Guard shape.** research.md/design.md/plan.md all specified `typeof localStorage !==
   'undefined'`. Running the suite showed this technically works but violates the AC's "without
   warnings": Node 20+'s `globalThis.localStorage` is an accessor property, and merely evaluating
   `typeof` on it invokes the getter, which emits `ExperimentalWarning: localStorage is not
   available because --localstorage-file was not provided` on every touch. Fixed by guarding on
   `typeof window === 'undefined'` instead — true only in the Node test project, and never
   touches the `localStorage` accessor at all when absent.
2. **jsdom's own `localStorage` was unreachable too.** Once guarded on `window`, the `dom`
   project surfaced a second issue: `window.localStorage` there was ALSO Node's broken accessor,
   not jsdom's real `Storage` — Vitest's jsdom environment setup (`populateGlobal()`) skips
   copying any window property that already exists as an own property of Node's `global`, and
   Node 20+'s `localStorage` is exactly such a property. Fixed with
   `src/app/vitest-dom-setup.ts`, a ~35-line in-memory `Storage`-shaped polyfill wired into the
   `dom` project's `test.setupFiles`. This is a Node-version/jsdom-version/Vitest-version
   interaction specific to this dev environment — irrelevant to any real browser, where
   `localStorage` just works.

Both are documented in full in structure.md (retroactively annotated) and progress.md. Neither
changed the ticket's design decisions (Decisions 1–6 in design.md all stand); both are
implementation-level fixes to make the already-decided design actually testable/warning-free in
this repo's toolchain.

## Test coverage

- **New:** `app.terminology.svelte.test.ts` (8 tests, `dom` project) + one new `describe` in
  `app.ssr.test.ts` (1 test, `node` project). Full suite: 912/912 passing across both projects,
  confirmed via repeated runs (no flakiness observed after the fixes above landed).
- **Manual browser verification** (Playwright against a real `just dev` server, headless
  Chromium, 390×844 viewport — no project run-skill existed for this repo, so used the `run`
  skill's browser-driven fallback): toggle renders beside "new game" at the same visual weight;
  click relabels every wind name live and reverts on a second click; the dealt hand's 13 tiles
  are unchanged; the storage key round-trips a REAL page reload (not just a `vi.resetModules()`
  simulation); zero console warnings/errors. Screenshots and the driver script were scratch
  artifacts, not committed to the repo.
- **`just check`** (svelte-check + tsc): clean, 197 files, 0 errors/warnings.
- **`just build`**: single-file gate passes, 104.31 kB (gzip 34.32 kB) — up ~0.7 kB from
  T-010-01-01's 103.6 kB baseline (the toggle markup/script plus the "中文" glyph).

**Gap — this ticket's tests don't touch every surface, by design.** T-010-01-03
(`dual-terminology-coverage`, already ticketed, depends on this one) owns the exhaustive
parameterized sweep of every prompt/screen under both terminologies. This ticket's own tests are
narrow (wind names, the toggle button's own label, the hand, the storage key) — deliberately, per
design.md Decision 5, to avoid writing a suite that ticket is about to write anyway.

**Gap — no automated check that the `.new-game`/`.terminology-toggle` comma-selector CSS stays in
sync if either rule is edited later.** A future edit to one selector's declarations without the
other would silently break "same visual register" with no test catching it (nothing in this repo
asserts computed styles). Flagging, not fixing — matches the level of CSS testing already present
everywhere else in `src/app/`.

## Open concerns for human attention

1. **The Node/jsdom `localStorage` environment issue (Deviation 2) is worth a second look from
   someone who knows this toolchain's version history.** I traced it to Vitest's
   `populateGlobal()` key-filter interacting with Node 20+'s built-in `localStorage` global, but
   I did not check whether upgrading/downgrading `jsdom`, pinning a Node flag
   (`--no-experimental-webstorage`, if one exists), or a newer Vitest release makes the polyfill
   unnecessary. If any of those is the "real" fix, `vitest-dom-setup.ts` and its `vite.config.ts`
   wiring should be removed in favor of it. I chose the polyfill because it's small, self-
   contained, doesn't touch project tooling versions, and matches real-browser behavior exactly —
   but it is new test infrastructure this ticket introduced that nothing else in the repo needed
   before.
2. **`TERMINOLOGY_LABEL`'s "中文" choice is mine, not sourced from a native speaker**, same
   caveat T-010-01-01's review.md already raised for its own `zh-hant` term values — worth a
   native-speaker pass together with that ticket's list before either locks into more test
   assertions.
3. **The toggle button's label direction (destination, not current state) is a design choice
   (design.md Decision 4) that a reviewer should sanity-check against real usage** — it's the
   CLAUDE.md brand-voice-informed pick, but it is a convention some users find confusing on first
   encounter (i.e. "why does it say 中文 if I'm already in Japanese-style labels" reads fine once
   you tap it once, less fine before). No user testing was done; this is a judgment call, not a
   verified-correct one.
4. **This ticket's AC's "SSR renders (no localStorage) fall back to the default terminology
   without warnings" is now asserted directly** (app.ssr.test.ts's new block) — closing what was
   an implicit-only guarantee before this ticket.

## Nothing else outstanding

No TODOs left in touched files. All five commits build on a green suite at each step (verified,
not assumed — see progress.md's per-step verification notes). `src/core/` is untouched, confirmed
by the diff touching only `src/app/` and `vite.config.ts`.
