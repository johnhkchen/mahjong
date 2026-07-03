# Progress — T-010-01-01 term-dictionary-and-wiring

All plan.md steps completed, each committed independently with `just check` and `just test`
green before commit, plus a final `just build` gate check.

- [x] Step 1 — `093c40d` Add `src/app/dictionary.svelte.ts` (20-term table, `term()`,
  `activeTerminology()`, `setTerminology()`, `windTerm()`).
- [x] Step 2 — `fc030f8` Wire `ClaimPrompt.svelte` (`callName`, win aria-label consolidated).
- [x] Step 3 — `e564ea2` Wire `RiichiPrompt.svelte` (ask line, declare/decline buttons).
- [x] Step 4 — `b40ed98` Wire `Table.svelte` (`SEATS` → `$derived` over `windTerm`, furiten
  badge, yakuless notice).
- [x] Step 5 — `21cf81d` Wire `HandEnd.svelte` (dropped local `WIND` const, ryuukyoku/tenpai/
  noten/dora/fu/han/next-hand).
- [x] Step 6 — `c9c2503` Wire `App.svelte` (tenpai hint).
- [x] Step 7 — Grep audit (clean) + `just build` (single-file gate: 103.6 kB, passes). No
  code change needed, so no commit for this step.

## Deviations from plan.md

One deviation, caught by `just check` during Step 2 and fixed before committing: the plan
implicitly assumed a `.svelte.ts` module imports with its full extension
(`'./dictionary.svelte.ts'`); `tsc`'s `bundler` resolution rejects an explicit `.ts` import
extension without `allowImportingTsExtensions`. Fixed by importing `'./dictionary.svelte'`
(drop the trailing `.ts`) everywhere — Vite/Svelte resolves this correctly, matching how the
rest of the codebase imports extensionless modules (`from './drive'`).

A second small deviation surfaced in Step 5: `windTerm`'s planned signature (`seat: 0 | 1 | 2 |
3`, matching core's `Seat` shape) didn't typecheck against `#each` block loop indices, which
Svelte types as plain `number`. Widened `windTerm(seat: number)` — noted in its own doc comment
— rather than casting at every call site; every real caller only ever passes a valid seat index
0-3, so this is a pragmatic widening, not a correctness gap.

All other steps matched structure.md/plan.md exactly.
