# Research — T-010-01-03 dual-terminology-coverage

## Ticket ask

AC: "A parameterized suite renders the key surfaces under each terminology and asserts the
expected labels (吃/碰/槓/胡/自摸 vs CHI/PON/KAN/RON/TSUMO and friends); `just build` passes the
single-file size gate; `just check` clean." Context names the surfaces explicitly: prompts
(call/win/riichi), seat labels, furiten badge, hand-end and score screens.

This is a test-only ticket. `src/app/dictionary.svelte.ts` (T-010-01-01) and every consumer
(T-010-01-01/02) already exist and are wired. No production vocabulary gap is expected to
surface, but the two prior tickets both flagged the same gap in their own review.md files:
**the `zh-hant` path has never been rendered by any test.** T-010-01-01 review.md: "the `zh-hant`
path is entirely untested… only proofread by me while writing them." T-010-01-02 design.md
Decision 5 / review.md: explicitly deferred the exhaustive per-surface sweep to this ticket.

## The dictionary (`src/app/dictionary.svelte.ts`)

- `Terminology = 'romaji' | 'zh-hant'`.
- `TermKey` — 20 entries: `chi pon kan ron tsumo riichi ryuukyoku tenpai noten furiten east south
  west north declareRiichi notYet nextHand dora fu han`.
- `term(key)` reads `TERMS[key][current]`. `windTerm(seatIndex)` maps 0-3 → east/south/west/north
  → `term()`.
- `current` is **module-scoped `$state`**, seeded once at import (`loadStored()`), not
  prop-drilled or context-provided. `setTerminology(next)` sets `current` unconditionally, and
  additionally writes `localStorage` only when `typeof window !== 'undefined'` — i.e. calling
  `setTerminology('zh-hant')` from a plain Node vitest file (the `node` project, no `window`
  global) still flips `current`, it just skips the storage write. This is the load-bearing fact
  that makes an SSR-based parameterized sweep possible without jsdom or a mount: `svelte/server`'s
  `render()` is synchronous and reads whatever `current` is at call time.
- `activeTerminology()` reads `current` back out.

## Where each TermKey actually renders (confirmed by reading every consumer)

| Key | Component | Context |
|---|---|---|
| `chi`, `pon`, `kan` | `ClaimPrompt.svelte` | `callName()` → button text + `aria-label` for chi/pon/daiminkan claim choices |
| `ron` | `ClaimPrompt.svelte` | win button (`aria-label="{ron} {tile}"`); also `Table.svelte` furiten line ("ron is sealed on…") |
| `tsumo` | `ClaimPrompt.svelte` | win button text/aria-label; also `Table.svelte` furiten line ("tsumo still wins") and yakuless notice ("can only win by tsumo") |
| `riichi` | `RiichiPrompt.svelte` | ask line ("you're tenpai — declare riichi with…"); also `Table.svelte` yakuless notice ("riichi would fix this") |
| `tenpai` | `RiichiPrompt.svelte` ask line; `Table.svelte` yakuless notice is NOT tenpai but riichi (recheck); `HandEnd.svelte` ryuukyoku tenpai/noten list; `App.svelte` pre-tenpai hint text |
| `noten` | `HandEnd.svelte` ryuukyoku tenpai/noten list |
| `furiten` | `Table.svelte` furiten badge `aria-label` region text itself |
| `east/south/west/north` | `Table.svelte` `SEATS[i].wind` (seat labels, always rendered); `HandEnd.svelte` via `windTerm(seat)` in the winner line, the ryuukyoku tenpai list, and the scores list |
| `declareRiichi` | `RiichiPrompt.svelte` declare button text + aria-label |
| `notYet` | `RiichiPrompt.svelte` decline button text + aria-label |
| `nextHand` | `HandEnd.svelte` next-hand button text (only rendered when `onnext` passed) |
| `dora` | `HandEnd.svelte` dora line (only when `doraHan > 0`) |
| `fu`, `han` | `HandEnd.svelte` points line (only on non-limit hands; limit hands show `limitName` — core data, untranslated by design) |
| `ryuukyoku` | `HandEnd.svelte` ryuukyoku headline |

Correction on re-read: `Table.svelte`'s yakuless notice uses `term('tsumo')` AND `term('riichi')`
in one sentence ("no yaku — this hand can only win by tsumo; riichi would fix this"), not
`tenpai`. The furiten line uses `term('furiten')`, `term('ron')`, `term('tsumo')` in one sentence.

## Existing SSR fixtures already mined (all in `src/app/app.ssr.test.ts`, all `romaji`-only today)

These seeds already produce exactly the render states the ticket's surfaces need — this ticket
should reuse them rather than mine new ones, only adding `setTerminology('zh-hant')` /
`'romaji'` around fresh `render()` calls (SSR renders are stateless snapshots, not reused DOM):

- **Claim prompt (chi/pon)**: seed 15, 8 tsumogiri turns → East holds a pon and two chis at
  North's discard 45 (3p). Also seed 212 (8s daiminkan alongside a pon) for `kan`.
- **Win prompt (tsumo/ron)**: seed 542630 (tsumo point, turn-32 draw), seed 887141 (ron beside
  calls, turn-3 discard 8m), seed 1038928 (houtei ron, no draw).
- **Riichi prompt**: seed 397, East's opening draw, one tenpai-preserving discard (tile 130/6z).
- **Seat labels**: any `render(App, …)` or `render(Table, { props: { table } })` — `SEATS` is
  unconditional, present at every phase.
- **Furiten badge**: seed 3951, `tsumogiriTurns(liveRon, 2)` → sealed (seat 3, tile 1s).
- **Yakuless notice**: seed 20899, dealt-only fold, seat 0 tenpai with no yaku.
- **Hand-end (tsumo, with dora)**: seed 542630 played to `tsumo` — yields yaku list, dora line
  (doraHan=1), fu/han/points line, scores list.
- **Hand-end (ron, bot winner)**: seed 3951 played to a bot `ron` — winner-by-wind line,
  `from` wind.
- **Hand-end (ryuukyoku)**: `BOOT_SEED=1`, 70 tsumogiri turns to wall-exhaustion — ryuukyoku
  headline, tenpai/noten list, scores.
- **Next-hand button**: any ended `Table` render with `onnext` passed.

No fixture currently exercises a **limit hand** (`limitName !== null`), but `fu`/`han` need only
one non-limit anchor (542630 already is one) — a limit-hand path is out of this ticket's named
surfaces (points line is covered either way; `limitName` itself is core-authored, untranslated by
design per T-010-01-01 review.md point 3).

## Test infrastructure conventions already established

- `app.ssr.test.ts` renders via `render` from `'svelte/server'` in the `node` vitest project
  (`vite.config.ts`'s `node` project, `environment: 'node'`, excludes `*.svelte.test.ts`).
  Plain `.test.ts` files run here. No jsdom, no mount/unmount, no `flushSync` — a pure function
  call returning `{ body }`.
- `tsumogiriTurns(live, n)` and `foldRecord` are the standard fixture-construction helpers,
  copied per-file (already duplicated between `app.ssr.test.ts` and other suites — no shared
  helper module exists in `src/app/` today).
- `regionTokens(body, label, closeTag)` and `tileTokensOf(body)` are `app.ssr.test.ts`-local
  helpers for extracting tile glyphs from an aria-labeled region.
- `app.terminology.svelte.test.ts` (T-010-01-02, `dom` project, jsdom + mount) is deliberately
  narrow — the toggle's own behavior (live relabel, persistence). It is NOT the exhaustive sweep;
  this ticket does not need to duplicate its jsdom/mount machinery. The AC's "SSR/component
  tests" phrasing covers both existing suites; the new work here is naturally SSR since every
  named surface (prompts, seat labels, furiten badge, hand-end) already renders via `svelte/server`
  in `app.ssr.test.ts` today under `romaji` only.
- `setTerminology` and `activeTerminology` are exported from `dictionary.svelte.ts` and already
  imported by `App.svelte`; nothing prevents a plain `.test.ts` file (node project) from importing
  and calling them directly around `render()` calls, same as any other test-only setup step.
  `afterEach`/`afterAll` must reset `setTerminology('romaji')` so terminology state — a
  module-level singleton — doesn't leak across test files sharing a worker, mirroring
  `app.terminology.svelte.test.ts`'s own existing `afterEach` reset pattern.

## Build/check gates

- `just build` → `vite build && node scripts/verify-single-file.mjs`. Gate checks: exactly one
  `dist/index.html`, >10,000 bytes, starts with `<!doctype html>`, has `id="app"`, no
  `src=`/`href=` reference attributes, no remote CSS `url()`, and a **300,000-byte ceiling**
  (current build, per T-010-01-02 review.md, is ~104.3 kB — over 2.5x headroom). This ticket adds
  no production code, so the built artifact should not change at all; the gate is expected to
  pass trivially, but the AC calls it out explicitly (Lisa's own build verification, most likely) so it must be run and observed as part of Implement, not merely assumed.
- `just check` → `svelte-check --tsconfig ./tsconfig.json && tsc -p tsconfig.node.json --noEmit`.
- Both `flox` and a local `node_modules/.bin/vitest` are present in this environment; `just`
  recipes route through `flox activate --`.

## Open questions carried into Design

1. Whether to add a **new test file** (e.g. `app.terminology.coverage.ssr.test.ts`) vs. extend
   `app.ssr.test.ts` in place with a parameterization wrapper. The latter risks a large diff to
   an already-long, heavily-commented file and duplicates fixture-building logic that already
   exists there; the former risks re-deriving fixtures already mined once.
2. Whether zh-hant assertions should be byte-for-byte glyph strings (matching the ticket's own
   literal example: 吃/碰/槓/胡/自摸) or derived from `TERMS` map values imported directly (avoids
   hand-copying glyphs into the test, but weakens the test as a change-detector if `TERMS` itself
   is wrong — T-010-01-01 review.md's own flagged risk: the zh-hant values are unverified
   proofreading, not a native-speaker pass).
3. How literally to take "parameterized" — a `for (const t of TERMINOLOGIES)` loop producing one
   assertion set per surface (readable, but every failure needs the failing terminology named in
   the assertion message) vs. `describe.each`/`it.each` (vitest-native parameterization, clearer
   failure output, more idiomatic given the ticket's own word choice).
