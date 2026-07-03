# Plan — T-009-03-01 tenpai-riichi-prompt

## Mined fixtures (scratchpad-scanned, frozen anchors — never regenerate)

- **Seed 397, `[{ type: 'draw', seat: 0 }]`** — East's very first action (the dealer's
  own initial draw). Hand `[103,6,34,130,66,35,33,113,57,99,14,115,106]` + drawn `61`
  (7p). `legalActions` yields the 14 plain discards then **exactly one** riichi offer:
  `{ type: 'riichi', seat: 0, tile: 130 }` (130 = 6z, hatsu). `discardPolicy` over this
  state independently agrees: `{ type: 'riichi', seat: 0, tile: 130 }` — confirms the
  non-dead-wait path. `scoresIn` fresh (25000 each), `melds` empty (closed). This is the
  **declare-path anchor**: `riichiPrompt(state, offered, 0)` must resolve to
  `{ tile: 130, declare: <riichi:130>, decline: <discard:130> }`, both `toBe` identity
  with the matching `offered` elements.
- **Seed 1, 8 tsumogiri turns + East's 9th draw** (`docs/active/work` note: this is the
  *exact* `midHand` fixture already defined in `app.ssr.test.ts` — no new fixture, just
  import/reuse its construction). `drawn = 13`, `melds = []`, `riichi[0] = false`,
  `shanten([...hand, 13].map(kindOf), []) === 2`. This is the **hint anchor**: pre-
  tenpai, no riichi offer, `tenpaiHint(seatView(midHand, 0))` must equal `2`.
- **Dead-wait check (deferred, not required by this ticket's AC):** no fixture mined for
  the dead-wait branch of `riichiPrompt` (where `discardPolicy` returns a `discard`
  rather than a `riichi` for the tenpai tile). The AC doesn't require covering it and
  `discardPolicy`'s own test suite (T-009-02-01) already exercises `isDeadWait`
  independently; `riichiPrompt`'s fallback branch is exercised by code inspection and
  the `discard`-branch `.find` idiom mirrors the `riichi`-branch one closely enough that
  a unit test isn't pulling its own weight here. Flag in review.md rather than force a
  fixture hunt.
- **Locked-seat check:** `tenpaiHint` must return `null` once `view.riichi[seat]` is
  true (forced tsumogiri — nothing to hint). Reuse T-009-01-01's own riichi-locked
  fixtures (`legal.test.ts`/`record.test.ts` likely already fold a locked state) or
  simply extend the seed-397 anchor one step further: fold `[..., { type: 'riichi',
  seat: 0, tile: 130 }]` and re-project `seatView` — `drawn` will be the next draw once
  seat 0's turn comes back around, or immediately after the riichi action seat 0 has no
  further own action until its next draw, so this needs the SAME anchor advanced by one
  full round (4 more `draw`+`discard` for seats 1–3, tsumogiri) to reach seat 0's next
  draw, still locked. Confirm shape while implementing step 2 below; adjust if the
  fixture is awkward — a hand-authored short record is acceptable since this is a
  boundary check, not a scenario needing a "real" deal.

## Steps

### 1. `drive.ts`: `riichiPrompt` + `tenpaiHint`

- Add the two exports per structure.md, placed after `winChoice`.
- Unit tests in `drive.test.ts`, new `describe('riichiPrompt')` / `describe('tenpaiHint')`
  blocks near the existing `describe('winChoice', ...)` (if one exists — pattern-match
  the file's existing per-function `describe` blocks):
  - riichiPrompt: seed-397 anchor → `declare`/`decline` are `toBe` the exact `offered`
    elements (identity, the file's own convention); a fixture with **no** riichi offer
    at all (e.g. the existing `dealt`/`afterEastDraw` anchors already in the file, if
    they hold no riichi offer — confirm) → `riichiPrompt` returns `null`.
  - tenpaiHint: the reused `midHand`-shaped fixture (construct locally or import a
    shared builder if one exists after this ticket — likely just re-derive inline,
    matching `app.ssr.test.ts`'s own local construction rather than exporting a
    cross-file test helper) → returns `2`; the pre-draw `dealt` anchor (`drawn ===
    null`) → returns `null`; a locked-seat fixture → returns `null`.
- Verify: `just test` (or `npx vitest run src/app/drive.test.ts`) green.
- Commit: "Add riichiPrompt and tenpaiHint selectors to drive.ts (T-009-03-01)".

### 2. `RiichiPrompt.svelte`

- New file per structure.md's markup/props/styling spec.
- SSR test in `app.ssr.test.ts`, new `describe('riichi prompt view (SSR)')` block
  mirroring the existing "win prompt view (SSR)" block's structure: render
  `RiichiPrompt` directly with `tile: 130` and no-op handlers, assert:
  - the group landmark (`aria-label="riichi prompt"`);
  - the tile renders (reuse `regionTokens`-style scoping or a direct `toContain` on the
    kind token, matching the file's existing tile-assertion idiom);
  - all three stakes lines' `aria-label`s are present with non-empty text;
  - both button `aria-label`s (`"declare riichi"`, `"not yet"`) are present.
- Verify: `just test` green; visually sanity-check via `just dev` (manual — see step 3's
  end-to-end note) is deferred to step 3 since App.svelte isn't wired yet.
- Commit: "Add RiichiPrompt.svelte (T-009-03-01)".

### 3. `App.svelte` wiring

- Add the `riichi`/`hint` derived values, the `declareRiichi`/`declineRiichi` handlers,
  the console `{:else if}` branches, and the `seatView`/`RiichiPrompt`/`riichiPrompt`/
  `tenpaiHint` imports, per structure.md.
- Extend `app.ssr.test.ts`'s existing "dealt-table view (SSR)"/"no hand-end region"
  style coverage is not needed here (App's fresh-boot SSR render has no draw, so
  neither the prompt nor the hint should show — already implicitly covered by the
  existing "shows no prompt at the freshly dealt boot" assertion continuing to hold,
  since neither new branch fires without a draw).
- New end-to-end test, `app.riichi.tap.svelte.test.ts` (jsdom mount, matching
  `app.controls.svelte.test.ts`'s fake-timer/`flushSync` pattern): mount `App` with
  `initialSeed: 397`, advance timers until the console shows `aria-label="declare
  riichi"` (the bots auto-play; East's own first-draw riichi decision should be the
  very first pause since seed 397's anchor is turn 0), then:
  - **declare-path test:** click "declare riichi", flush, assert the last logged action
    (or an observable proxy — e.g. the discard pond gains tile 130's kind, `table.riichi
    [0]` is unobservable directly from the DOM, so assert via the pond/points-stick
    proxy: `won.pot` isn't directly rendered either — check what IS observable; likely
    assert the NEXT own-turn discard is forced-tsumogiri by checking only one button
    remains tappable, or simplest: assert the riichi prompt/hint no longer appears on
    East's following turn and the discard pond's tile at that position matches kind
    '6z'). Confirm the concrete assertion while implementing — prefer whatever the
    rendered DOM already exposes (pond tiles, per `Table.svelte`) over adding new
    render surface just for the test.
  - **decline-path test:** same mount, click "not yet" instead, assert a plain discard
    of tile 130 (kind '6z') lands in East's pond and the hand continues (no lock — a
    later turn, if still eligible, could show the prompt again; asserting "not locked"
    is the AC's own decline contract, and is checkable by NOT having a permanently-
    forced-tsumogiri next turn, i.e. multiple distinct discard kinds appear in East's
    pond across a couple more auto-played turns).
- Verify: `just test` green; manual sanity pass via `just dev` with `?seed=397` — visit,
  confirm the console banner renders and both buttons behave, per the repo's UI-change
  convention (test the golden path in a browser before calling it done).
- Commit: "Wire the riichi declare/decline prompt and shanten hint into App (T-009-03-01)".

### 4. Wrap-up

- `just check` (svelte-check + tsc) — confirm no type errors across the new files.
- Re-read `docs/active/tickets/T-009-03-01.md`'s AC line against the finished diff:
  prompt-renders-exactly-when-offered ✓, stakes-text-present ✓, decline-folds-plain-
  discard ✓, accept-folds-riichi-action ✓, hint-tracks-fold-derived-shanten ✓, no
  engine logic added to `src/app/*.svelte` (only `shanten`/`discardPolicy` calls,
  both pre-existing core reads) ✓.
- Write `progress.md` as work lands (one entry per commit above), then `review.md`.

## Testing strategy summary

| Layer | File | New coverage |
|---|---|---|
| Pure selectors | `drive.test.ts` | `riichiPrompt`, `tenpaiHint` — identity + null cases |
| SSR/presentational | `app.ssr.test.ts` | `RiichiPrompt` rendering, stakes text, landmarks |
| End-to-end | `app.riichi.tap.svelte.test.ts` (new) | declare and decline flows through a real mounted `App` |

No changes to `src/core/*` means no property-test or fixture-table churn in
`legal.test.ts`/`policy.test.ts`/the dynamics suite — this ticket is additive at the
app layer only, matching structure.md's "no `src/core` changes" note.
