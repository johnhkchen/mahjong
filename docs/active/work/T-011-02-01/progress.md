# Progress — T-011-02-01: window-outcome-notice

## Completed

- [x] **Research** — mapped `settleWindow`'s reference-equality invariant (the
  cheap, exact "did the player's own tap win" test), the claim shapes available
  post-settlement, the existing dictionary/component conventions, the console
  cascade, the per-hand reset precedent (`dismissed`), and three already-frozen
  `drive.test.ts` fixtures usable for pure-function coverage with no new mining.
  `research.md`.
- [x] **Design** — decided a pure `windowOutcome()` in `drive.ts` (reference
  equality), a new `WindowNotice.svelte` component, a shared `callTerm()` promoted
  from `ClaimPrompt.svelte`'s private helper, a 2000ms auto-dismiss deliberately
  longer than the existing race fixture's 750ms reopen gap (so that fixture also
  proves cascade preemption), and explicit `notice` clearing on every window
  resolution path. `design.md`.
- [x] **Structure** — file-by-file plan: `drive.ts`, `dictionary.svelte.ts`,
  `ClaimPrompt.svelte`, `App.svelte`, `WindowNotice.svelte` (new), plus test
  changes across `drive.test.ts`, `app.terminology.coverage.ssr.test.ts`, and
  `claim-window-race.tap.svelte.test.ts`. `structure.md`.
- [x] **Plan** — seven-step sequence, flagging Step 6 (the interactive "wins"
  case) as the one genuine unknown. `plan.md`.
- [x] **Implement**:
  - `windowOutcome()`/`WindowOutcome`/`CallType` added to `drive.ts`; unit tests
    in `drive.test.ts` reusing three already-frozen fixtures (seed 3 loss, seed
    15 win, tsumo-point null) plus a defensive null-settled case — no new mining
    at the pure-function layer.
  - `callTerm()` added to `dictionary.svelte.ts`; `ClaimPrompt.svelte`'s private
    `callName` deleted and replaced with the shared helper — verified byte-
    identical output (existing terminology/tap suites unchanged, still green).
  - `WindowNotice.svelte` authored (new file) and covered directly in
    `app.terminology.coverage.ssr.test.ts` under both terminologies (two cases:
    a chi-loses-to-pon outcome, a daiminkan-named-as-kan outcome).
  - `App.svelte` wired: `notice` state, `NOTICE_DURATION_MS = 2000`, the
    auto-dismiss `$effect`, `windowOutcome()` calls in `claim()`/`takeWin()`,
    explicit `notice = null` in `pass()`/`newHand()`/`newGame()`, and the
    four-tier cascade (`{:else if notice !== null}`) with a documenting comment.
  - `claim-window-race.tap.svelte.test.ts` (T-011-01-01's file): flipped the
    `// DEFECT:` marker to assert the notice's presence and exact content
    (West/pon/chi), and appended one assertion proving cascade preemption (the
    reopened claim prompt renders instead of the still-logically-live notice).
  - New `window-outcome-notice.tap.svelte.test.ts` covers the two conditions the
    existing race fixture can't (see Deviations): "never when passed" (same
    seed-344 fixture, alternate branch) and "never when it wins" (a freshly
    mined tsumo fixture, seed 2654435389/core-396).
  - Full suite: `npm test` (40 files, 948 tests) and `npm run check`
    (svelte-check + tsc, 0 errors) both green. `npm run build` verified — single
    file, 106KB, well under the size gate.
  - All scratch mining scripts deleted before finalizing (never committed).
- [x] **Review** — this document's sibling, `review.md`.

## Deviations from the plan

- **Concurrency with T-011-02-02.** A sibling Lisa thread was actively
  implementing T-011-02-02 (fresh-prompt-beat) in the SAME working tree for most
  of this ticket's Implement phase — it had already added window-identity keying
  and CSS motion to `App.svelte`/`ClaimPrompt.svelte`, and its own DEFECT-flip to
  `claim-window-race.tap.svelte.test.ts`, before and while this ticket's edits
  landed (it fully committed partway through — see `git log`: `279f6dc`/`f779a4e`).
  Handled by re-reading each shared file immediately before editing it (the
  harness's stale-read guard caught the first collision) and keeping this
  ticket's footprint in shared files minimal and additive. No conflict in the
  final state — `plan.md`'s Structure §Ordering was followed with files re-read
  fresh at each step.
- **The "wins" interactive case used a different fixture than planned, and
  surfaced a real, out-of-scope bug.** `plan.md`/`design.md` planned to reuse
  `claim-window-race.tap.svelte.test.ts`'s own seed-344 fixture by tapping its
  SECOND window's chi (mined as uncontested). Doing so crashes: the player's own
  successful chi/pon/daiminkan puts them into `TableState.mustDiscard` (an
  11-concealed/1-meld shape), and `src/core/legal.ts`'s `furitenSeal`/`waits`
  don't handle that shape (`waits()` asserts exactly `10 - 3*melds` concealed
  tiles) — `App.svelte`'s unconditional `furitenSeal(table, PLAYER)` throws the
  instant this happens. No existing suite had ever driven a player's own
  successful claim through the mounted App, so this was previously unexercised
  and undiscovered. This is a real, pre-existing, **out-of-scope** defect (E-011
  is view/drive-only; the fix belongs in `src/core/`) — flagged prominently in
  `review.md`, not fixed here. Pivoted instead to a TSUMO-based "wins" fixture
  (mined fresh: game seed 2654435389, core seed 396, uncontested tsumo in 33
  actions/9 player turns) — a tsumo never mutates `hands[seat]`
  (`record.ts`'s `applyWinTail`), so it doesn't hit the bug, and a tsumo is
  always uncontested by construction, which is exactly the "wins" case needed.
  This required a new test file (`window-outcome-notice.tap.svelte.test.ts`)
  rather than extending `claim-window-race.tap.svelte.test.ts` further, since the
  fixture and driver shape (a generic step-driver, houtei-dismissal's own
  pattern) differ enough from that file's simple round-tapping to warrant it —
  also reducing edit surface in a file the sibling thread was concurrently
  committing to.
- **The "passed" case landed in the new file too**, alongside "wins", rather
  than as a second `it` inside `claim-window-race.tap.svelte.test.ts` — same
  rationale (minimize footprint in the actively-co-edited file; the new file is
  a natural home for "the other two AC conditions" as a pair).
- Everything else (drive.ts, drive.test.ts, dictionary.svelte.ts, ClaimPrompt.svelte,
  WindowNotice.svelte, the terminology coverage additions, App.svelte's wiring)
  matched structure.md/plan.md as written.

## Known limitations / what this ticket deliberately does NOT do

- Does not fix the `furitenSeal`/`waits`-vs-`mustDiscard` crash bug discovered
  during Implement (see review.md's critical-issue flag) — out of scope for a
  view/drive-only epic.
- Does not touch `settleWindow`'s arbitration semantics or any other
  `src/core/` file.
- Does not add the fresh-prompt-beat/remount distinctness fix — T-011-02-02's
  own scope, already landed concurrently.
- No dedicated unit test for the per-hand `notice = null` resets in
  `newHand()`/`newGame()` — mirrors `dismissed`'s own precedent defensively;
  no existing fixture ends a hand immediately after a lost claim to exercise it
  directly. Flagged as an open item in review.md rather than mining a fixture
  solely to cover it.
