# Structure — T-011-02-02: fresh-prompt-beat

## Files modified

### `src/app/App.svelte`

One new `$derived` binding and one `{#key}` wrap around the existing `<ClaimPrompt>`
usage — no other line in the file changes.

- **New `$derived` (placed beside `prompt`/`win`, after line 72, before the `dismissed`
  comment block)**: `promptKey` — a string computed from `table.claimable`:
  `` table.claimable !== null ? `${table.claimable.seat}:${table.claimable.tile}` :
  'no-window' ``. A short comment documents why the string form was chosen over the
  object itself (design.md's Option 4 rationale, condensed) and why the fallback
  literal is safe (no-window prompts are the tsumo point only, which ends the hand — it
  never needs to "reopen" against itself).
- **Console block (lines 222-231 today)**: the `<ClaimPrompt ... />` element gets
  wrapped in `{#key promptKey}...{/key}`. Every existing prop stays byte-for-byte
  identical; only the wrapping changes. The `{:else if riichi !== null}`/`{:else if
  hint !== null}` branches and their contents are untouched — the key applies to
  exactly the one branch the AC names.
- No new imports (`{#key}` is core Svelte template syntax, no import required).

### `src/app/ClaimPrompt.svelte`

One new CSS block, appended inside the existing `<style>` element (after the `.pass`
rule, before the closing `</style>`). No script or markup change — the component's
props, logic, and DOM shape are completely unchanged; motion is presentation-only,
exactly the E-007 precedent's own scoping.

- `@media (prefers-reduced-motion: no-preference) { .prompt { transition: ...;
  @starting-style { ... } } }` — mirrors `Table.svelte`'s `.pond li`/`.drawn` shape
  (design.md Option 1): `opacity`/`transform` transition, 200ms `ease-out`, translateY
  fade-in. A comment documents the duration choice (inside `BOT_DELAY_MS`) and the
  `{#key}` dependency (this transition only ever fires because App.svelte guarantees a
  fresh mount — same load-bearing relationship Table.svelte's own comments describe for
  their recreated-element cases).

### `src/app/claim-window-race.tap.svelte.test.ts`

One block edited — the second `// DEFECT:` comment and its two assertions (current
lines ~144-153, "the two prompts are structurally identical... no fresh-prompt beat").
Everything else in the file (the header comment, the mount/query helpers, the first
`// DEFECT:` block covering the "no visible outcome" scope, all setup/fixture-sanity
assertions) is untouched — that block belongs to T-011-02-01, not this ticket.

- The comment flips from `// DEFECT:` to a fixed-behavior explanation (design.md's
  "Test strategy" section, condensed): the shared `aria-label`/`className` is expected
  chrome (same call type), not a defect, once remount-not-patch is guaranteed and the
  beat exists.
- Two new assertions are added after the existing `toBe` pair:
  - `expect(secondPromptNode).not.toBe(firstPromptNode)` — different DOM references.
  - `expect(firstPromptNode.isConnected).toBe(false)` — the original node was actually
    detached, the fact a same-node patch would fail to produce.
- No new mount, no new fixture, no new seed — reuses the exact `firstPromptNode`/
  `secondPromptNode` bindings the file already captures at lines 101 and 140.

## Files created

None.

## Files deleted

None.

## Ordering

1. `ClaimPrompt.svelte`'s CSS addition first (independent of App.svelte; can be
   verified in isolation via the existing SSR/unit suites, which don't inspect
   `<style>` content but must keep compiling/rendering cleanly).
2. `App.svelte`'s `{#key}` wrap second (depends on nothing new from step 1, but keying
   without the CSS in place would produce a correct-but-invisible remount — sequencing
   this second means the moment the test suite is updated in step 3, both the
   structural guarantee and the visible beat already exist together).
3. `claim-window-race.tap.svelte.test.ts`'s assertion flip last, run against the
   completed change from steps 1-2 — this is the step that proves the other two did
   what they claim.

No step touches `src/core/` or any file outside `src/app/`. No ordering dependency
exists between this ticket's files and T-011-02-01's (a different console branch, a
different `// DEFECT:` block in the same test file) — `plan.md`'s verification step
re-runs the FULL suite specifically to catch any accidental interaction between the two
tickets' edits to the same test file, should T-011-02-01 land concurrently.

## Module boundaries / public interfaces

Unchanged. `App.svelte` exports nothing (a Svelte component's default export is
unaffected by internal template structure); `ClaimPrompt.svelte`'s prop contract
(`claimed`, `choices`, `win`, `canPass`, `onclaim`, `onpass`, `onwin`) is untouched — the
new CSS reads no new prop and the component's public surface is identical before and
after. The test file exports nothing (test-only, as every other `*.test.ts` in this
repo). No new public interface is introduced anywhere in `src/core/` or `src/app/`.
