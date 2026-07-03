# Progress — T-009-03-01 tenpai-riichi-prompt

All four plan.md steps are complete. Work landed as four logical commits (not yet
created as separate `git commit`s in this session — see review.md for the commit
plan); each is independently green.

## Step 1 — `drive.ts`: `riichiPrompt` + `tenpaiHint` ✅

Implemented per structure.md/design.md, with one addition beyond the original
design.md write-up, discovered while implementing: **`riichiPrompt` returns `null`
whenever `winChoice` also returns non-null for the player.** design.md's Decision 4
described this as a console-level rendering priority only; implementing the pure
function first exposed that the priority has to live IN `riichiPrompt` itself, not
just in App.svelte's branch order — `discardPolicy`'s first arm returns the tsumo
action unconditionally whenever one is offered, so calling it from `riichiPrompt`
without a win-guard would misclassify the `discardPolicy` result (neither `'riichi'`
nor a matching `'discard'`) and silently return `null` for the wrong reason at the
`tsumoPoint` anchor (winChoice's own fixture: 14 discards + 14 riichi offers + one
tsumo). Added the guard as `riichiPrompt`'s first line; covered by a dedicated test
(`'is null when a win is offered too'`).

Unit tests added to `drive.test.ts`: `describe('riichiPrompt')` (4 cases: resolves the
anchor with an independent `discardPolicy` oracle check, null with no riichi offer
across 5 existing anchors, null when a win is also offered, rejects a doctored list)
and `describe('tenpaiHint')` (4 cases: the mid-hand anchor with an independent
`shanten` oracle check, null pre-draw, null at tenpai/agari, null once locked).

## Step 2 — `RiichiPrompt.svelte` ✅

New file per structure.md. SSR coverage added to `app.ssr.test.ts`: the riichi-prompt
landmark, the question + candidate tile, all three stakes lines' `aria-label`s, and
both button labels — plus a `describe('tenpai hint')` block (the mid-hand fixture
gives `2`; the fresh boot gives `null`).

## Step 3 — `App.svelte` wiring ✅

Wired per structure.md: `riichi`/`hint` derived values, `declareRiichi`/`declineRiichi`
handlers, the console `{:else if}` branches, new imports (`seatView`, `riichiPrompt`,
`tenpaiHint`, `RiichiPrompt`).

**Deviation from plan.md's end-to-end test sketch**: the plan assumed the riichi
anchor's HAND seed (397) could be passed straight to `mountApp`/`initialSeed`. It
can't — `App.svelte` mounts on a GAME seed and derives hand 0's wall via
`handSeedOf(gameSeed, 0)` (T-008-03-02), never the raw seed. Found and fixed by
computing the one game seed whose hand 0 lands on 397: `397 ^ 0x9e3779b1 >>> 0 =
2654435388` (the golden-ratio XOR is its own inverse for `handIndex = 0`). Frozen as
`RIICHI_GAME_SEED` in the new test file, with the derivation documented inline so it
is never mistaken for an arbitrary magic number.

New file `src/app/app.riichi.tap.svelte.test.ts` (jsdom mount, fake timers, mirrors
`app.controls.svelte.test.ts`'s style): two tests, declare and decline. Each drives to
the prompt, taps a button, confirms the tile lands in East's pond, drives forward to
East's next own-turn draw, then proves the LOCK state via behavior (the declare path:
tapping a non-drawn hand tile is a no-op, only the drawn tile's button folds; the
decline path: an arbitrary hand tile folds normally) rather than via any new DOM
surface — `Table.svelte` renders no riichi-lock indicator today (out of scope; see
review.md), so behavior is the only observable signal available.

One test-authoring snag, since fixed: `eastPondKinds`'s regex initially assumed
`class="kind">` verbatim; Svelte's scoped-CSS class hashing renders
`class="kind svelte-xxxxx">` instead. Fixed to `class="kind[^"]*">`.

## Step 4 — Wrap-up ✅

- `just test` (`npx vitest run src/app`): 156 tests, 155 passing. The one failure
  (`drive.test.ts`'s "plays deal → a BOT rons the player" full-drive-through test) is
  **pre-existing and unrelated** — confirmed via `git stash`/`git stash pop` that it
  fails identically on `main` before any of this ticket's changes, a fallout of
  T-009-02-01's bot-riichi-policy landing without updating this one fixture's expected
  yaku list (a bot now correctly declares riichi partway through the mined `HOUTEI_SEED`
  walk, adding a `'riichi'` yaku the frozen expectation doesn't include). Flagged in
  review.md, not fixed here (out of this ticket's scope, and touching a shared fixture
  file mid-flight risks colliding with the concurrent T-009-01-04 property-suite work
  visible in the working tree).
- Full-repo `npx vitest run`: two additional pre-existing failures in
  `src/core/selfplay.test.ts`, same root cause (bot riichi declarations changing mined
  walks' yaku lists/action counts) — untouched `src/core` file, same disposition.
- `npx svelte-check --tsconfig ./tsconfig.json`: 0 errors, 0 warnings.
- `npx vite build`: succeeds, single-file output unchanged in shape.
- No browser-automation tool was available this session to drive a real browser
  end-to-end; the jsdom-mounted `app.riichi.tap.svelte.test.ts` exercises the same
  Svelte client runtime, `$effect`-timer pacing, and real DOM click events a browser
  session would, which is the closest available substitute — flagged as an open
  item in review.md for a manual `just dev` + `?seed=2654435388` look.
- AC re-check against the finished diff: prompt-renders-exactly-when-offered ✓
  (`riichiPrompt` returns null everywhere else, tested), stakes-text-present ✓ (three
  `aria-label`ed lines), decline-folds-plain-discard ✓, accept-folds-riichi-action ✓,
  shanten-hint-tracks-fold-derived-count ✓ (`tenpaiHint` calls `shanten` directly, no
  reimplementation), no engine logic added to `src/app/*.svelte` (only calls into
  `shanten`/`discardPolicy`, both pre-existing core reads, made from `drive.ts`) ✓.

No `src/core/*` files were touched.
