# Plan — T-010-01-01 term-dictionary-and-wiring

Testing strategy: no new test file is added by this ticket (T-010-01-03 owns the parameterized
dual-terminology suite). The regression net is the EXISTING suite — `app.ssr.test.ts`,
`drive.test.ts`, `app.controls.svelte.test.ts`, `app.riichi.tap.svelte.test.ts`,
`hand-end.tap.svelte.test.ts`, `table.tap.svelte.test.ts`, `tile.ssr.test.ts` — which must pass
byte-for-byte unchanged after every step, per the ticket's own acceptance criterion. Each step
below runs `just test` and `just check` before committing; a step that fails either is a design
mistake to fix before moving on, not a deferred cleanup.

## Step 1 — Add `src/app/dictionary.svelte.ts`

Write the module per structure.md: `Terminology`, `TermKey`, the 20-key `TERMS` table (19
listed + verifying none missing), `term()`, `activeTerminology()`, `setTerminology()`,
`windTerm()`. No existing file imports it yet.

Verify: `just check` (typechecks in isolation — an unimported file still typechecks under
svelte-check/tsc); `just test` (must be a no-op pass — nothing changed behaviorally).

Commit: "Add the term dictionary module (romaji default, zh-hant second terminology)".

## Step 2 — Wire `ClaimPrompt.svelte`

Apply structure.md's `callName`/aria-label changes. Manually cross-check every default value:
`term('chi')==='chi'`, `term('pon')==='pon'`, `term('kan')==='kan'`, `term('ron')==='ron'`,
`term('tsumo')==='tsumo'` — all satisfied by Step 1's table already.

Verify: `just test` — specifically `app.ssr.test.ts`'s "claim prompt view" and "win prompt view"
describe blocks (aria-labels `"pon 3p with 3p 3p"`, `"chi 3p with 2p 4p"`, `"kan 8s with 8s 8s
8s"`, `"ron 8m"`, `"tsumo"`, `"pass"`) and `drive.test.ts` (unaffected — it only exercises
`drive.ts`, which this ticket never touches, but run the full suite regardless since `just test`
runs everything in one pass). `just check`.

Commit: "Route ClaimPrompt's call/win vocabulary through the term dictionary".

## Step 3 — Wire `RiichiPrompt.svelte`

Apply structure.md's ask-line/button changes.

Verify: `just test` — `app.ssr.test.ts`'s "riichi prompt view" describe block (`"you're
tenpai"`, `aria-label="declare riichi"`, `aria-label="not yet"`) AND
`app.riichi.tap.svelte.test.ts` (the two DOM-selector-driven end-to-end tests clicking
`'[aria-label="declare riichi"]'`/`'[aria-label="not yet"]'` — the highest-risk assertions in
this whole ticket, per design.md Decision 4). `just check`.

Commit: "Route RiichiPrompt's tenpai/riichi/declare/decline vocabulary through the term dictionary".

## Step 4 — Wire `Table.svelte`

Apply structure.md's `SEATS`/furiten/yakuless changes, introducing `windTerm`.

Verify: `just test` — `app.ssr.test.ts`'s "dealt-table view," "mid-hand table view," "meld
display," and "furiten badge and yakuless notice" describe blocks (wind-name single-occurrence
counts, `>1s<` furiten tile, `"tsumo still wins"`, `"no yaku — this hand can only win by tsumo;
riichi would fix this"` verbatim); `table.tap.svelte.test.ts`; `app.riichi.tap.svelte.test.ts`'s
`eastPondKinds` helper (depends on `aria-label="east pond"`, untouched per Decision 3, so this
is a should-still-pass sanity check, not a new risk). `just check`.

Commit: "Route Table's wind names and furiten/yakuless vocabulary through the term dictionary".

## Step 5 — Wire `HandEnd.svelte`

Apply structure.md's `WIND`→`windTerm`, ryuukyoku/tenpai/dora/fu/han/next-hand changes.

Verify: `just test` — `app.ssr.test.ts`'s "hand-end view" and "wall-exhausted table view"
describe blocks are the dense ones here: `"East (you) wins by tsumo"` and `"North wins by ron
from East"` (whitespace-collapsed compares — must still match after the `windTerm`/`by`-term
substitution), the yaku list's `"{name} {han}han"` (untouched per structure.md's explicit
note), the dora line, the fu/han/points line, the tenpai/noten list, the scores list, `"next
hand"` button presence/absence branching, `"ryuukyoku"` substring. `app.controls.svelte.test.ts`
(scores/next-hand control flow, no text assertions but exercises the same render paths).
`just check`.

Commit: "Route HandEnd's wind/ryuukyoku/tenpai/dora/fu/han/next-hand vocabulary through the term dictionary".

## Step 6 — Wire `App.svelte`

Apply the one-line hint change.

Verify: `just test` full suite once more (nothing in the existing suite asserts the exact hint
sentence, per research.md, so this is a belt-and-suspenders full run); `just check`.

Commit: "Route App's tenpai hint through the term dictionary".

## Step 7 — Grep audit + build gate

Grep `src/app/*.svelte` for each of the nine ticket-named terms in both scripts (romanized:
chi/pon/kan/ron/tsumo/riichi/ryuukyoku/tenpai/furiten; CJK: 吃碰槓胡自摸立直流局聽牌振聽) and the
four wind words/kanji, confirming zero hits outside `dictionary.svelte.ts` itself (Table's
`SEATS`/HandEnd's former `WIND` are gone; the wind kanji never appeared in `src/app/*.svelte` to
begin with — they're new, dictionary-only). Run `just build` to confirm the single-file gate
still passes with the added module and the small amount of new CJK text inlined (T-010-01-03
owns the formal size-gate assertion in test, but confirming it builds now avoids discovering a
break two tickets later).

No commit (verification-only step) unless the grep finds a straggler, in which case fix and
commit "Finish routing the last hardcoded {term} occurrence" before proceeding to Review.

## Explicitly not in this plan

- No `localStorage` read/write, no toggle UI, no terminology-switching interaction —
  `setTerminology`/`activeTerminology` are exported and unused by any consumer (T-010-01-02).
- No new test file (T-010-01-03).
- No yaku-name or `limitName` translation (out of scope per design.md Decision 7).
- No change to `src/core/`, `drive.ts`, `Tile.svelte`, `main.ts`.
