# Plan — T-010-01-02 toggle-and-persistence

Each step is independently committable; run `npm test` (or `just test`) after every step and
`just check` before the final commit. Steps follow structure.md's ordering exactly.

## Step 1 — `dictionary.svelte.ts`: guarded persistence

- Add `STORAGE_KEY`, `isTerminology`, `loadStored()`.
- Swap the `current` initializer to `loadStored()`.
- Extend `setTerminology()` with the guarded write.
- Update the two stale "future toggle" doc comments to present tense.
- **Verify:** full existing suite green, unchanged (`just test`) — this step must be behaviorally
  invisible to every test that doesn't touch `localStorage`, since `loadStored()` returns
  `'romaji'` whenever the key is absent (every test's actual starting condition today, jsdom or
  Node). Manually confirm in a scratch REPL or one throwaway assertion that `typeof
  localStorage === 'undefined'` really does hold in the Node vitest project (research.md's claim,
  worth confirming once rather than trusting research secondhand) — remove the throwaway
  assertion before committing.
- **Commit 1.**

## Step 2 — `App.svelte`: the toggle control

- Extend the `dictionary.svelte` import.
- Add `TERMINOLOGY_LABEL`, `otherTerminology`, `toggleTerminology`.
- Add the header button markup.
- Widen the `.new-game` CSS selector to include `.terminology-toggle`; widen `:active` too.
- **Verify:**
  - `just check` (svelte-check + tsc) — new markup/script must typecheck cleanly, `Terminology`
    import included.
  - `just test` — full suite green. In particular `app.controls.svelte.test.ts`'s
    `querySelector('.new-game')` must still resolve to exactly the new-game button (Decision 3's
    whole reason for a comma-selector instead of a shared class) — confirm by reading that test's
    assertions still pass, not just "no error."
  - Manual: `just dev`, load the app, confirm the toggle renders next to "new game" at the same
    height/visual weight, tap it, confirm every visible term flips (wind names at minimum;
    open the riichi/claim prompts if reachable within a hand to eyeball those too) and flips back
    on a second tap. This is the UI-verification pass CLAUDE.md requires for frontend changes —
    do not skip it even though the automated suite covers the same ground, since a real browser
    is the only way to eyeball "same visual register" and the ≥44px target isn't asserted by any
    test in this plan (svelte-check doesn't check computed layout).
- **Commit 2.**

## Step 3 — `app.terminology.svelte.test.ts`

Write the file per structure.md's outline. Concrete assertions, not placeholders:

- **Relabels live:** mount, read `target.textContent` (or scoped queries) for `East`/`South`/
  `West`/`North` before click; click `[aria-label^="switch to"]`; `flushSync()`; assert those four
  strings are gone and `東`/`南`/`西`/`北` each appear exactly once (mirrors
  `app.ssr.test.ts`'s existing "renders all four wind seats exactly once" pattern, applied to the
  zh-hant glyphs).
- **Hand undisturbed:** `handTileCount(target)` (reuse `app.controls.svelte.test.ts`'s helper
  shape, 13 at fresh boot) identical before and after the click; additionally assert the same set
  of `discard {kind}` aria-labels is present before/after (proves it's the SAME 13 tiles, not
  coincidentally 13 different ones — cheap: capture the labels into an array and deep-equal).
- **Toggles back:** two clicks returns wind text to `East`/`South`/`West`/`North`.
- **Writes the key:** click once, `expect(localStorage.getItem('mahjong-terminology')).toBe('zh-hant')`.
  Also assert `Object.keys(localStorage).filter(k => k.startsWith('mahjong')).length === 1` (or
  equivalent) somewhere in this describe block — a direct check on "exactly one key," not just
  "this one key has this value" (a regression that also wrote a second key would pass every other
  assertion here).
- **Fresh module reload:** `localStorage.setItem('mahjong-terminology', 'zh-hant')`,
  `vi.resetModules()`, dynamically `await import('./App.svelte')` and `await
  import('./dictionary.svelte')`, mount the freshly-imported `App`, assert wind text shows
  `東`/`南`/`西`/`北` immediately at boot — no click needed. This is the test that actually
  proves "read at boot," not just "write on toggle."
- **Absent key defaults to romaji:** `localStorage.clear()`, `vi.resetModules()`, fresh import +
  mount, assert `East`/`South`/`West`/`North`.
- **Malformed value falls back, no throw:** `localStorage.setItem('mahjong-terminology',
  'pig-latin')`, `vi.resetModules()`, fresh import + mount — must not throw, must show
  `East`/`South`/`West`/`North` (falls back to default, not to `undefined`/blank labels).
- Every test that calls `setTerminology`/toggles restores state in `afterEach` per structure.md
  (Decision 6) — write the `afterEach` first, before the first test, so no test can be added later
  without it.
- **Verify:** `just test` — new file green, and re-run the FULL suite (not just the new file) to
  confirm no cross-file leakage (the hazard research.md/Decision 6 flag) — if `app.controls.
  svelte.test.ts` or `app.riichi.tap.svelte.test.ts` fail ONLY when run after this new file (pass
  in isolation), that is the leakage bug; fix by strengthening this file's `afterEach`, not by
  reordering test files.
- **Commit 3.**

## Step 4 — `app.ssr.test.ts` addition

- Add the `describe('terminology (SSR, no localStorage)', ...)` block from structure.md.
- **Verify:** `just test` (Node project specifically: `npx vitest run --project node` or the
  equivalent `just` recipe if one targets a single project) — confirms `render()` truly never
  touches `localStorage` and never calls `console.warn`/`console.error`. This is the test that
  encodes the AC's literal "without warnings" phrase as an assertion rather than an assumption.
- **Commit 4.**

## Step 5 — Final gate

- `just check` (svelte-check + tsc) clean.
- `just test` full suite green (all projects).
- `just build` — single-file size gate passes; the two new CJK glyphs (中文 on the toggle,
  already present via T-010-01-01's `TERMS` table for 東南西北 etc.) add negligible bytes, no
  gate risk expected, but confirm the build actually reports the gate as passing rather than
  assume it.
- Grep sanity: `grep -n "localStorage" src/app/dictionary.svelte.ts` shows exactly the guarded
  read/write pair from Decision 1/2 — one key name, no stray second key anywhere in `src/`.
- Update `progress.md` summarizing the four commits; write `review.md`.

## Testing strategy summary

| Concern | Where |
|---|---|
| Toggle relabels live, hand undisturbed | `app.terminology.svelte.test.ts` (jsdom, mounted) |
| Exactly one `localStorage` key, round-trips a simulated reload | `app.terminology.svelte.test.ts` (jsdom, `vi.resetModules()`) |
| Absent/malformed storage falls back to default | `app.terminology.svelte.test.ts` (jsdom) |
| SSR path never touches storage, never warns | `app.ssr.test.ts` addition (Node) |
| Visual register / ≥44px target / real-browser toggle feel | manual `just dev` pass, Step 2 |
| No existing consumer regresses | full suite re-run after every step |

No new unit test file for `dictionary.svelte.ts` in isolation (no existing precedent — T-010-01-01
shipped it with zero dedicated unit tests, relying on the SSR/tap suites as the regression net;
this ticket's `app.terminology.svelte.test.ts` exercises `loadStored()`/`setTerminology()`'s
persistence behavior at the integration level instead, which is where the observable contract
("read at boot," "persists") actually lives).
