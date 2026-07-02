# T-003-02-01 — progress

## Step 0 — baseline gate ✅
- `just test`: 72/72 green (9 files). `just check`: 0 errors, 0 warnings. Clean baseline.

## Step 1 — SSR spec ✅ (commit 38b8dac)
- `src/app/app.ssr.test.ts`: added `tsumogiriTurns` (script builder off the empty fold's
  live wall), `regionTokens` (indexOf-based label slice + `tileTokensOf`, loud on missing
  label), the mid-hand fixture (8 turns, `actions[1]` swapped to tedashi of
  `dealt.hands[0][0]`, pending 9th East draw) and the 70-turn exhausted fixture, plus two
  describe blocks rendering Table directly (design D1).
- Verified red-for-the-right-reasons: 4 of 6 new tests failed on missing pond /
  aria-current / drawn-tile / banner markup; zero fold RangeErrors (fixtures legal);
  existing 5 App tests untouched and green.
- Deviation from plan, noted not fixed: 2 of the new tests passed pre-implementation —
  the wall-counter test (Table already rendered the counter; the fixture only proves it
  tracks a mid-hand fold) and the no-aria-current-after-end test (vacuously true until
  commit 2 introduced the attribute; it now guards the phase gate). Both remain
  meaningful against the finished view.

## Step 2 — Table.svelte ✅ (commit 6551110)
- Ponds per seat (unconditional `<ul>`, lowercase `"{wind} pond"` labels via a literal
  `pond` field on SEATS), `aria-current="true"`/`class:active` gated on
  `phase === 'playing' && i === table.turn` via `{@const active}`, player-only drawn-tile
  chip outside the hand list, `role="status"` ryuukyoku banner in the center panel.
- Styles: `.pond` shares the `.hand` flex ruleset + min-height/max-width; `.seat.active`
  underline cue; `.drawn`; `.ended`.
- `just test`: 81/81 green. `just check`: 0 errors, 0 warnings.

## Step 3 — eyeball pass ⚠️ partial
- `just build` green: dist/index.html self-contained at 42.65 kB (was the walking
  skeleton's smaller table; still comfortably a single file).
- No browser available in this session, so the visual layout check (empty ponds not
  distorting the felt grid on the boot table) did not happen — carried as an open
  concern into review.md. Layout risk is CSS-only; the AC is fully carried by the SSR
  tests, which are green.

## Step 4 — artifacts ✅
- research / design / structure / plan / progress / review written; committed together
  as the final artifact commit. Ticket frontmatter untouched throughout (Lisa's job).

## Plan deviations (complete list)
1. Step 1's "all new tests fail" expectation was 4/6 (see above) — assertions kept as
   designed; no test was weakened to force a red.
2. Step 3's `just dev` eyeball replaced by a `just build` smoke — noted as review
   concern, not silently skipped.
