# Research — T-011-02-03: window-legibility-regression-suite

## Ticket in one line

Close E-011: no `// DEFECT:` markers remain, and the outcome notice + fresh-prompt
beat are covered as a parameterized matrix across chi/pon/ron windows × both
terminologies, with `just test`/`just check`/`just build` green.

## State of the working tree at Research time

`docs/active/tickets/T-011-01-01.md`, `T-011-02-01.md`, `T-011-02-02.md` are all
`phase: done` (uncommitted frontmatter bump — Lisa's own bookkeeping, per
`rdspi-workflow.md` §Phase Rules 3, never committed by an implementing agent). Their
code is **not evenly committed**: T-011-01-01 and T-011-02-02 landed as normal
incremental commits (`c5f5a2f`/`0a43ee9`/`77fb87d`, `6cb6d28`/`279f6dc`/`f779a4e`), but
**T-011-02-01's entire implementation sits uncommitted in the working tree** — its
`docs/active/work/T-011-02-01/` is untracked and no commit anywhere touches
`WindowNotice.svelte`. Its own `review.md` (dated, complete) confirms the ticket was
fully implemented and self-reviewed; the session just never committed. This ticket
builds directly on top of that code (T-011-02-03 `depends_on: [T-011-02-01,
T-011-02-02]`), so it is verified working first (full `just test`/`just check` pass,
see below), then landed as its own catch-up commit before this ticket's own commits,
so history correctly attributes each ticket's diff.

## What exists today (post T-011-01-01/02-01/02-02)

### `src/app/drive.ts`
- `CallType = 'chi' | 'pon' | 'daiminkan' | 'ron'`, `WindowOutcome { winner: Seat,
  winnerType: CallType, playerType: CallType | 'tsumo' }`.
- `windowOutcome(chosen, settled)`: pure reference-equality comparison, null when
  `settled` is null, `settled === chosen` (own tap won), or either type guard fails.
  No fold/legalActions call inside it at all — it only compares two `HandAction`
  values already in hand. This means **hand-built synthetic `HandAction` pairs are a
  legitimate, precedented way to unit-test it** (no mining required for the pure
  function layer).
- `settleWindow`: offered-position precedence — rons before pons before daiminkans
  before chis (legal.ts's own frozen order). A player's pon can only ever lose to an
  earlier-offered ron; a player's chi can lose to a ron, pon, or daiminkan.

### `src/app/dictionary.svelte.ts`
- `callTerm(type)` and `windTerm(seat)`, shared by `ClaimPrompt` and `WindowNotice`.
  `setTerminology`/`activeTerminology` are plain module-scoped rune reads — callable
  from ANY test (interactive or SSR) with no prop-drilling, so terminology can be
  parameterized around an existing interactive fixture without re-mining anything.

### `src/app/WindowNotice.svelte`
Pure presentational: `role="status"`, `aria-label="winner"/"winning call"/"your
call"`, no computation.

### `src/app/App.svelte`
- Four-tier console cascade: claim prompt > outcome notice > riichi prompt > hint
  (documented inline, lines ~270-278).
- `notice` state set by `claim()`/`takeWin()` via `windowOutcome`; cleared by
  `pass()`, `newHand()`, `newGand()`, and its own 2000ms auto-dismiss timer.
- `promptKey` (T-011-02-02): `` `${claimable.seat}:${claimable.tile}` ``, or
  `'no-window'` at the tsumo point — wraps `<ClaimPrompt>` in `{#key promptKey}`, so
  every distinct window is a genuine remount (`isConnected` proof already
  established for one chi→chi transition).

### Existing coverage inventory

| File | Fixture | Covers |
|---|---|---|
| `claim-window-race.tap.svelte.test.ts` | seed 344 (game), interactive | chi loses to pon (notice); chi→chi remount + cascade preemption. **Romaji only** — no terminology parameterization. |
| `window-outcome-notice.tap.svelte.test.ts` | seed 344 (pass branch) + seed 396/core 396 (tsumo), interactive | notice absent on pass; notice absent on an uncontested win. Romaji only. |
| `app.terminology.coverage.ssr.test.ts` | hand-built `WindowOutcome` literals, SSR render | chi-loses-to-pon and daiminkan-labeled-kan, **both terminologies already** — but no `ron` anywhere as winner or player type. |
| `drive.test.ts` `windowOutcome` describe | seed 3 (chi loses to pon), seed 15 (pon wins → null), tsumoPoint (→ null), houteiEnd `settled===null` | No `ron` case at all — winnerType or playerType. |

### Gap against the AC

1. No `// DEFECT:` markers remain anywhere in source (only historical/narrative
   mentions in comments and docs) — this half of the AC is **already satisfied** by
   prior tickets; verified by `grep -rn "DEFECT" src/`.
2. `ron` is untested as a call type anywhere in the outcome-notice/fresh-prompt
   surface — neither as `winnerType` nor `playerType`, interactively or at the
   pure-function/SSR layer.
3. No interactive fixture exercises **any** window type other than chi (seed 344's
   both windows are chi).
4. No interactive test runs under `zh-hant` terminology at all — every `.tap.` suite
   is implicitly romaji-only (the module-scoped `current` rune defaults to romaji
   and nothing calls `setTerminology`).
5. T-011-02-01 review.md's own open concern #2 is still open: no fixture ends a
   hand immediately after a lost window (the `notice = null` resets in
   `newHand()`/`newGame()` are unexercised).

## Mining findings (this ticket, scratchpad only — not committed)

Using the exact functions the real driver tests already use (`forcedAction`,
`discardPolicy`, `riichiPrompt`, `settleWindow`, `claimChoices`, `winChoice` —
`houtei-dismissal.tap.svelte.test.ts`'s own `step()`/`driveUntil()` shape, replicated
in a throwaway script, never committed), scanning core seeds 1..50000 for "the
player's only claim offer is a pon, and it loses to an earlier-offered ron":

- **Core seed 85** (game seed `85 ^ 0x9e3779b1 >>> 0 = 2654435812`): at 76 real
  actions in, a lone pon offer (tile 45, 3p) with no competing bot offer — the
  generic driver's own decline (a pass tap) folds it to the head draw, exactly the
  existing "pass never produces a notice" doctrine. Two actions later (78 total), a
  SECOND, distinct window opens: tile 82 (3s) offers the player a pon `[83, 80]`
  **and South a ron on the same tile** — `settleWindow` picks South's ron (rons
  outrank pons). This single fixture, in one hand, gives:
  - A second genuine remount (a fresh claimable window after the first silently
    resolved) — a same-type (pon→pon) data point distinct from seed 344's
    chi→chi transition.
  - `playerType: 'pon'`, `winnerType: 'ron'` in ONE interactive walk — two of the
    three AC-named call types in a single mined fixture.
  - Because a ron completes the hand (`agari`), the console's cascade collapses to
    `notice` alone (no next claim window this hand) while `Table`'s `HandEnd`
    simultaneously renders the score screen — directly exercising T-011-02-01
    review.md's open concern #2 (the `notice = null` reset on `newHand()`) for the
    first time.

No fixture was found (or attempted at real interactive cost) for `playerType: 'ron'`
losing to another ron (atamahane) — mining two *simultaneous* ron offers where the
player's own is not the earliest is a materially bigger search (needs a shanpon-like
double-ron geometry, not just "a claim + a ron"). `windowOutcome` is pure and doesn't
touch the fold at all, so this combination is fully covered at the unit level with a
synthetic `HandAction` pair — precedented by `app.terminology.coverage.ssr.test.ts`'s
own hand-built `WindowOutcome` literals one file over. Design.md decides this
tradeoff explicitly.

## Full-suite baseline (before this ticket's changes)

`just test`: 40 files, 948 tests — **1 flaky failure**,
`src/core/game.dynamics.test.ts`'s full-seed-domain property test
(`fc.integer({min:0,max:0xffffffff})`, `numRuns: 8`, no pinned seed). Reproduced
once (`seed -1266320619`: "riichi by seat 2 with -1500 points, fewer than the
1000-point stick" — a real `src/core/record.ts`/policy bug allowing a riichi
declaration under-stick). Three immediate reruns of the isolated file all passed.
This is a **pre-existing, out-of-scope core-engine bug**, unrelated to E-011 (view/
drive-only scope) — same category as T-011-02-01's own flagged `furitenSeal`/`waits`
crash. Not fixed here; flagged in review.md for a follow-up ticket. `just check` and
`just build` were not run yet at Research time (deferred to Implement/Review).

## Constraints and conventions this ticket must follow

- Never hardcode a mined action list in an interactive suite — always a generic
  driver recomputing from a live fold (this repo's established convention, three
  suites deep now).
- Hand-built `WindowOutcome`/`HandAction` literals for pure/SSR-level coverage are
  precedented, not a shortcut — used already in
  `app.terminology.coverage.ssr.test.ts` and legitimate for `windowOutcome` (no fold
  inside it).
- `afterEach(() => setTerminology('romaji'))` is the established reset convention
  (`app.terminology.coverage.ssr.test.ts` line 120) — any new suite that calls
  `setTerminology` in a non-default case must reset it the same way, since the rune
  is module-scoped and leaks across files/tests otherwise.
- No new shared driver-helper module — `design.md`/`structure.md` from
  T-011-01-01/-02-02 both explicitly decided against one (two-or-three call sites is
  still below this repo's own extraction threshold); a fourth near-identical
  `step()`/`driveUntil()` copy in this ticket's new file continues that precedent
  rather than reversing it (worth a second look if a fifth ever appears).
