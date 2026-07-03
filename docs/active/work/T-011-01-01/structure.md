# Structure — T-011-01-01: claim-window-interaction-repro

## Files created

### `src/app/claim-window-race.tap.svelte.test.ts` (new)

Covers AC sequences (a) and (b) in one suite, one mounted `App`, one mined
fixture (game seed `2654435561`, hand-0 core seed `344`).

- **Module-level constant**: `RACE_GAME_SEED` — the frozen game seed, with a
  header comment documenting exactly how and where it was mined (mirrors
  `drive.test.ts`/`app.riichi.tap.svelte.test.ts` convention).
- **Mount/query helpers** (duplicated per this repo's own no-shared-test-utils
  convention, documented in design.md): `mountApp`, `drawnButton`,
  `callButtons`, `claimPrompt`, `tickUntil` (extended from
  `app.riichi.tap.svelte.test.ts`'s own version to return the tick count spent —
  needed to assert the reopened window lands "quickly").
- **One `describe` block, one `it`**: a single continuous walk —
  1. Five tsumogiri rounds (tap the drawn tile, `tickUntil` between each) to
     reach the window.
  2. Fixture-sanity assertions: exactly one deduped chi button, its aria-label,
     no West meld yet.
  3. Tap the chi (the AC (a) moment) — assert the window closed to WEST's pon
     (meld + claimed pond mark) with the player's hand untouched and NO outcome
     element anywhere (`// DEFECT:` comment marking what the eventual fix
     flips).
  4. `tickUntil` the second window (bounded at exactly 3 ticks — asserted, not
     just bounded) — assert its button (AC (b) moment): same aria-label SHAPE
     (`chi 2s with 3s 4s`), and literal DOM-identity-adjacent equality
     (`aria-label`/`className` both `toBe` the first prompt's) — the
     `// DEFECT:` marker for the "no fresh-prompt beat" gap.

No exports; nothing else in the repo imports this file (test-only, as with
every other `*.test.ts` in this codebase).

### `src/app/houtei-dismissal.tap.svelte.test.ts` (new)

Covers AC sequence (c). One mounted `App`, one mined game seed
(`HOUTEI_GAME_SEED = 2654433429`, hand-0 core seed `2340`; hand-1 core seed
`2723775479` reached via the SAME game seed's natural continuation).

- **Module-level constant**: `HOUTEI_GAME_SEED`, with the same style of mining
  header comment.
- **Generic step-driver** (new to this suite; not shared with the other new
  file — see design.md's rejected-shared-module note):
  - `step(target, state, offered, actions)` — one decision: decline any
    claim/win offered to the player (tap "pass"; returns `'dismissed'` on the
    exact `settleWindow` null-with-nothing-offered case), else tick the bot
    timer once if `forcedAction` fires, else decline a riichi offer (tap "not
    yet"), else tap discardPolicy's own recommended tile (via
    `sortedDisplay`-position lookup, `table.tap.svelte.test.ts`'s convention).
  - `driveUntil(target, coreSeed, actions, stop, guardLimit)` — loops `step`
    until either `stop(state, offered)` is true (checked BEFORE acting, so the
    caller can assert on the exact stopping state) or the driver reports
    `'dismissed'`.
  - `sortedDisplay`, `handButtons`, `drawnButton`, `claimPrompt`,
    `nextHandButton` — small local query helpers, same shapes as the other
    suites'.
- **One `describe` block, one `it`**:
  1. `driveUntil` with a `stop` that never fires — drives hand 0 all the way to
     the dismissal itself (returns `'dismissed'`).
  2. Fixture-sanity: `ryuukyoku` phase, exactly one offer left (a ron, for the
     player, on `2m`).
  3. Assert no prompt renders, but the next-hand control does.
  4. Click next-hand — assert still no prompt (a fresh, empty-offering deal).
  5. `driveUntil` hand 1 (fresh `coreSeed`/`actions`) with a `stop` predicate
     that fires the moment the player holds a claim or win offer.
  6. Assert the prompt IS visible and names the mined chi (`chi 3m with 1m 2m`)
     — the regression assertion itself.

## Files modified

None. This ticket is test-only, per E-011's own scoping ("view/drive-only...
this epic changes what the player sees, not what folds") and T-011-01-01's own
charter (characterization BEFORE any fix). `src/core/`, `src/app/drive.ts`,
`src/app/App.svelte`, and `src/app/ClaimPrompt.svelte` are all read-only
references for this ticket.

## Files deleted

None (the mining scratch scripts used during Research/Design were deleted
before this phase — see progress.md; they never entered the committed tree).

## Ordering

No ordering dependency between the two new test files — independent fixtures,
independent mounts, no shared module. Both can be authored/committed in either
order or a single commit; `plan.md` sequences them as two commits purely for
reviewability (one AC pairing per commit), not because of any technical
dependency.

## Module boundaries / public interfaces

Unchanged. Both new files are leaf test modules: they import from `../core`
and `./drive`/`./App.svelte` (existing public surfaces) and export nothing.
No new public interface is introduced anywhere in `src/core/` or `src/app/`.
