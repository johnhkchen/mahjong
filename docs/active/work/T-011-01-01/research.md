# Research — T-011-01-01: claim-window-interaction-repro

## Ticket in one line

Script the owner's three playtest sequences (mixed claim-window race, consecutive
same-kind windows, houtei dismissal outliving its hand) as jsdom interaction tests
that pin CURRENT behavior with `// DEFECT:` markers, before any UI fix lands (E-011's
later tickets, T-011-02-*, own the actual fix).

## The reported defect (E-011, owner playtest 2026-07-04)

"The chi dialogue appears twice and gums up the notifications... happens with pon
too, seems like a race condition." Epic's own diagnosis (E-011.md): the ENGINE is
sound — `settleWindow` arbitration is rules-correct, one prompt render site — but
the drive/view layer has two legibility gaps:

1. A player's chi/pon tap enters `settleWindow` and can lose to a bot's
   higher-priority claim (pon > chi, ron > pon, per legal.ts's frozen offered
   order). The tap is silently discarded — nothing in the render says who won the
   window or with what — and the window's *winner* taking their claim discard
   often opens a fresh, similarly-shaped window shortly after, which reads as "the
   same dialog reappearing" rather than a new decision point.
2. The houtei `dismissed` flag (App.svelte) used to outlive its hand once E-008
   added game continuation; fixed inline 2026-07-04 (commit 3bcf9d3,
   `newHand()` now resets `dismissed`). Needs regression coverage, not a fix.

## Core files touching claim windows and houtei

- `src/app/drive.ts` — the seam. Key exports used by this ticket:
  - `claimChoices`/`promptChoices` (lines 93, 111) — the player's live claim
    offers, deduped for presentation by `(type, uses-by-kind)`.
  - `settleWindow` (line 193) — ONE arbitration for every seat: the player's
    tapped choice (or null/decline) joins the bots' `callPolicy` answers; the
    EARLIEST offered non-draw answer wins (offered position IS rules precedence:
    rons before pons before daiminkans before chis, atamahane rotation within
    rons). Returns the bot's action when it outranks the player's tap — this is
    the exact mechanism defect (1) exploits. Returns null when nothing settles
    (a windowless state, the tsumo point, or a declined player-only houtei) —
    this is what `dismissed=true` means downstream.
  - `forcedAction` (line 378) — drives everything that isn't the player's own
    decision; waits (`null`) exactly when the player holds a claim/win offer.
  - `botSeatsHoldingOffers` (line 157) — used internally by `settleWindow` and
    `forcedAction` to know whether any bot needs consulting.
- `src/app/App.svelte` — the one render site and the one place state lives:
  - `claim()` (line 128) / `pass()` (line 135) / `takeWin()` (line 141) all fold
    through `settleWindow` and push whatever it returns — there is no branch
    anywhere that compares "what I tapped" to "what got pushed." This is
    defect (1)'s root: the UI has literally no place to surface a loss.
  - `dismissed` (line 76) — houtei-only presentation state, reset in `newHand()`
    (line 171, the 3bcf9d3 fix) and `newGame()` (line 182, always did this).
  - The console `{#if}` (line 222): `ClaimPrompt` renders whenever
    `(prompt.length > 0 || win !== null) && !dismissed`; there is exactly one
    render site and no transition/keying between separate window-opens — a new
    window and "the old one still up" are visually indistinguishable in the DOM
    (same node, same classes, same aria-label shape).
- `src/app/ClaimPrompt.svelte` — pure input wiring: renders `choices` (deduped
  claim offers) and `win`, one button each, aria-labels of the shape
  `"{callName} {kindOf(tile)} with {uses.map(kindOf).join(' ')}"`
  (e.g. `"chi 8m with 6m 7m"`). No concept of "you lost the window" exists here
  or anywhere in the render tree.
- `src/core/record.ts` — `state.claimable` (window open marker, line 1041),
  ryuukyoku's houtei-only carve-out (line 1036 sets `phase = 'ryuukyoku'`;
  legal.ts's ryuukyoku arm then offers ONLY houtei rons, never a draw).
- `src/core/legal.ts` (line 442) — the ryuukyoku offering is exactly the houtei
  rons; no draw at the head there, which is why `settleWindow`'s decline branch
  (line 219: `if (head === undefined || head.type !== 'draw') return null`)
  returns null for a declined houtei — the `dismissed` branch in `App.svelte`'s
  `pass()`.

## Existing test conventions (this ticket must match, not invent)

- **jsdom client-mount suites** are named `*.svelte.test.ts` (selects vitest's
  `dom` project — jsdom + Svelte's browser build; `vite.config.ts`'s
  `resolve.conditions: ['browser']`). Plain `*.test.ts` runs under the `node`
  project instead (SSR/pure-function tests) — this ticket's tests MUST end in
  `.svelte.test.ts` to mount anything.
- **`app.riichi.tap.svelte.test.ts`** is the closest precedent: mounts the REAL
  `App` component (not a stand-in), uses `vi.useFakeTimers()` +
  `vi.advanceTimersByTimeAsync(BOT_DELAY_MS)` + `flushSync()` in a `tickUntil`
  helper to drive the bot-pacing `$effect` forward, and a frozen **GAME seed**
  computed as `handSeed ^ 0x9e3779b1 >>> 0` (the inverse of
  `game.ts`'s `handSeedOf(gameSeed, 0)`) so a specific per-hand geometry mined at
  the core level can be reached by mounting `App` with `initialSeed`.
- **`table.tap.svelte.test.ts`** mounts `Table.svelte` directly with a hand-built
  `TableState` prop (via `foldRecord`) — the AC's "hand-built records" allowance
  is precedent, not new. Used when the seam under test doesn't need `App`'s own
  state (`dismissed`, `hands` accumulation) — not this ticket's case for (a)/(b),
  which specifically needs `App`'s `claim`/`pass` closures and the console
  `{#if}`, but directly relevant precedent for how to mount and query.
- **`hand-end.tap.svelte.test.ts`** — same mount pattern, simpler (no fake
  timers), for a single click-through assertion.
- **Mined-seed convention** (drive.test.ts, legal.test.ts, game.test.ts,
  dynamics.test.ts, win.test.ts, etc.): a comment documents exactly how a
  fixture was found ("scratchpad scan," "probe-mined") and what it pins, then
  the seed/action-prefix is frozen as a literal — "never regenerate." Comments
  cite exact tile ids/kinds and turn numbers, cross-checked against the derived
  facts they claim. This repo's tests never assert "roughly" — every mined fact
  is exact and reproduced from a fresh `foldRecord`/`foldGame` run in the test
  itself (fixture-sanity assertions preceding the real assertions).
- **Crucially: `drive.test.ts`'s own header warns that seeds mined under a
  literal ALL-TSUMOGIRI assumption (the pre-T-006-03-03 fixtures, e.g. core-level
  `HOUTEI_SEED = 1038928`, `RON_ONLY_SEED = 362857`) do NOT reproduce the same
  geometry once real policy bots (`discardPolicy`/`callPolicy`) are driving —
  bots now discard by shanten-minimizing policy, not tsumogiri, and often win or
  reshape a hand long before the old walk's ending.** Any NEW fixture for a test
  that mounts the real `App` (which drives bots by real policy, not tsumogiri)
  must be mined fresh under `forcedAction`/`settleWindow`/`discardPolicy`/
  `callPolicy` — the exact functions `App.svelte`'s `$effect` calls — never
  reused from an old all-tsumogiri anchor.

## What was mined for this ticket (scratchpad scans, described in `design.md`)

- **Scenario (a)+(b) combined**: game seed `2654435561` (hand 0 core seed `344`).
  Five tsumogiri rounds reach a window where East (player) holds a deduped
  single chi choice (`8m` using `6m 7m`) and West holds a pon on the same tile —
  pon precedes chi in offered order, so tapping the player's only choice loses
  to West's pon. West's owed claim discard, then North's next draw+discard, open
  a SECOND window three forced ticks later offering the player another deduped
  chi (`2s` using `3s 4s`) — same call type, same one-button layout, no
  distinguishing marker from the first prompt. One seed pins both AC (a) and
  (b) — see design.md for why this is treated as one scenario rather than two.
- **Scenario (c)**: mining a fresh "houtei ron offered to the player alone,
  declined, then a next-hand prompt exists" geometry under real policy bots
  turned out to be far rarer than (a)/(b) (tenpai must survive untouched to the
  literal last tile with no earlier furiten-triggering offer) — a wide scan
  found no hit in the timeframe available. `design.md` covers the resulting
  scope call for this AC item.

## Constraints carried into Design

- No core changes — this ticket is test-only (view/drive is E-011's stated
  scope; T-011-01-01 itself doesn't even touch drive.ts/App.svelte).
- `just test` must stay green: new suites must actually pass today (they
  characterize CURRENT behavior, correct or buggy) — "DEFECT" markers are
  comments/assertions on today's actual output, not `.skip`/`.todo`/`expect.fail`.
- Every new fixture must be mined under real policy-bot driving
  (`forcedAction`/`settleWindow`/`discardPolicy`/`callPolicy`), never reused
  from a pre-policy-bot anchor, per the header warning above.
- File naming: `*.svelte.test.ts` for anything that mounts a component;
  `*.tap.svelte.test.ts` matches this repo's existing name shape for
  click-driven suites specifically (table.tap, app.riichi.tap, hand-end.tap).
