# Review — T-009-03-01 tenpai-riichi-prompt

## What changed

Three commits, additive only — no `src/core/*` file was touched (every fact this
ticket needed, `shanten`/`discardPolicy`/`seatView`/`legalActions`'s riichi offers,
already existed and was already exported):

1. **`src/app/drive.ts`** (+`drive.test.ts`) — two new pure selectors:
   - `riichiPrompt(state, offered, player): RiichiPrompt | null` — names the ONE
     candidate tile a "declare riichi?" prompt should ask about (reusing
     `discardPolicy`'s own recommendation, not an arbitrary first-offered tile) and
     both fold targets (`declare`/`decline`), both elements of `offered` itself.
     Defers to `winChoice` (returns `null` whenever a win is also offered — discovered
     during implementation, see "Deviations" below).
   - `tenpaiHint(view): number | null` — the pre-tenpai "N away from tenpai" fact,
     reading `shanten` directly over the seat's 14-tile arity; `null` pre-draw, at
     tenpai/agari (shanten ≤ 0), or once locked.
2. **`src/app/RiichiPrompt.svelte`** (new) — the stakes-explained banner: header +
   candidate tile, three one-line stakes (hand locks / 1000-point stick / riichi yaku
   + uradora chance, the ticket's own wording), declare/decline buttons. Stateless,
   computation-free, sibling to `ClaimPrompt.svelte`.
3. **`src/app/App.svelte`** — `riichi`/`hint` derived values, `declareRiichi`/
   `declineRiichi` handlers (each a single `activeHand().push(...)`, no
   `settleWindow` involved — this is the player's own-turn decision, not a claim
   window another seat could also answer), and two new `{:else if}` console
   branches, ordered after the existing claim/win branch.

Tests: `drive.test.ts` (+8 cases, pure selector coverage with independent
`discardPolicy`/`shanten` oracles alongside the frozen anchor), `app.ssr.test.ts`
(+6 cases, SSR content/landmark assertions), new
`app.riichi.tap.svelte.test.ts` (+2 cases, a real mounted `App` driven through both
the declare and decline paths with fake timers, proving the resulting lock behavior
by tap outcome rather than by reading any internal state).

## Test coverage

| Layer | Coverage | Gaps |
|---|---|---|
| `riichiPrompt`/`tenpaiHint` (pure) | Anchor resolution + oracle cross-check, null across 5+ no-offer anchors, win-supersedes case, locked case, doctored-list rejection | The dead-wait branch (`discardPolicy` returns a plain discard for a tenpai tile because every completing kind is already exhausted) has no dedicated fixture — see below |
| `RiichiPrompt.svelte` (SSR) | Landmark, question + tile, all three stakes lines, both buttons | None known |
| End-to-end (`App.svelte`) | Declare folds the riichi action + locks (only the drawn tile discards next turn); decline folds the plain discard + stays free | Only one anchor (seed 397 / game seed 2654435388) exercised; no multi-candidate-tile anchor exercised (see below) |

**Deliberately deferred, not a gap in the AC's own terms:**
- **The dead-wait branch of `riichiPrompt`.** No fixture was mined where
  `discardPolicy`'s tenpai-tile recommendation hits `isDeadWait` (T-009-02-01's own
  documented exception). `discardPolicy`'s own suite already covers `isDeadWait`
  independently; `riichiPrompt`'s two branches (`riichi`-first vs. `discard`-first)
  are structurally symmetric enough that hunting a specific dead-wait seed didn't seem
  worth the scratchpad time against this ticket's scope. Low risk, but worth a
  reviewer's second look at `riichiPrompt`'s second `if` block in drive.ts.
- **A multi-candidate riichi anchor.** Every fixture used here has exactly one
  tenpai-preserving tile. The `tsumoPoint` anchor (14 candidates) exercises the
  win-guard but never reaches `riichiPrompt`'s tile-selection logic with >1 real
  candidate (win short-circuits it to null). design.md's Decision 1 argues this
  doesn't matter functionally (the floor argument guarantees `discardPolicy`'s single
  chosen tile is always among whichever riichi offers exist), but no test pins the
  >1-candidate, no-win case specifically.

## Open concerns / known limitations

- **No visual riichi-lock indicator.** Real tables turn a riichi discard sideways;
  `Table.svelte` has no such mark today (only claimed-away discards get one). The
  end-to-end test proves the lock *behaviorally* (a locked seat's non-drawn hand
  tiles no longer fold), but a player watching the pond has no visual cue that a
  particular discard WAS the riichi declaration. Plausibly in scope for a follow-up
  (T-009-03-02 is already doing adjacent legibility work — furiten badge, yakuless
  notice — and a riichi-stick/sideways-tile mark would fit that same vein).
- **Three pre-existing, unrelated test failures**, confirmed via `git stash`/
  `git stash pop` to fail identically on `main` before this ticket's changes — all
  fallout of T-009-02-01 (bot riichi policy) changing mined self-play walks' yaku
  lists/action counts without updating the frozen expectations in three fixture
  files this ticket never touches:
  - `src/app/drive.test.ts` — "plays deal → a BOT rons the player" (expects
    `['ittsuu']`, now also gets `'riichi'`)
  - `src/core/selfplay.test.ts` — seed 25 (same shape) and seed 13 (`record.actions`
    length changed from 141 to 107 — a bot now declares riichi partway through the
    walk, changing its course entirely)

  Left unfixed here: out of this ticket's scope, and the working tree shows a
  concurrent thread's in-progress changes to `src/core/dynamics.test.ts`,
  `src/core/game.dynamics.test.ts`, and `src/core/legal.test.ts` (T-009-01-04's own
  riichi-property-suite ticket, still `phase: implement`) — the safer move is to let
  that thread (or a dedicated follow-up) reconcile these fixtures rather than editing
  shared test files mid-flight from an unrelated ticket.
- **No real-browser manual pass.** No browser-automation tool was available this
  session. `npx vite build` succeeds (single-file output, unchanged shape) and the
  jsdom-mounted `app.riichi.tap.svelte.test.ts` exercises the real Svelte client
  runtime, `$effect`-driven timer pacing, and genuine DOM click events — the closest
  available substitute — but a human glance at `just dev` + `?seed=2654435388` (the
  game seed whose hand 0 is the riichi anchor) would still be worth taking before
  calling the copy/styling itself final.
- **Copy is a first draft.** The stakes lines and "not yet" decline label are this
  session's wording, grounded in the ticket's own phrasing but not owner-reviewed —
  flag for a quick copy pass if the owner wants a different tone.

## AC re-check

- "the prompt renders exactly when legalActions offers riichi" — ✓ (`riichiPrompt`
  returns non-null iff `offered` holds a riichi action for the player and no win is
  also offered; tested null across every no-offer anchor and the win-coexistence
  anchor).
- "the stakes text is present" — ✓ (three `aria-label`ed lines, SSR-tested).
- "declining folds the plain discard" — ✓ (`declineRiichi` pushes
  `riichi.decline`, an element of `offered`; end-to-end test confirms the tile lands
  in the pond and the seat stays unlocked).
- "accepting folds the riichi action" — ✓ (`declareRiichi` pushes `riichi.declare`;
  end-to-end test confirms the tile lands in the pond and the seat locks).
- "the shanten hint tracks the fold-derived count" — ✓ (`tenpaiHint` calls `shanten`
  directly, no reimplementation; SSR-tested against an independent oracle call in
  `drive.test.ts`).
- "no engine logic in the view" — ✓ grep-checkable: `RiichiPrompt.svelte`/
  `App.svelte`'s new lines contain no `waits`/`shanten`/tie-break arithmetic of their
  own; the only core calls (`shanten`, `discardPolicy`, `seatView`, `legalActions`)
  are reads, made from `drive.ts` (App.svelte's existing precedent for direct core
  calls: `foldGame`, `legalActions` itself) or App.svelte's own established pattern.
