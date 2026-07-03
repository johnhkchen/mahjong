# Review — T-010-01-01 term-dictionary-and-wiring

## What changed

**Created:**
- `src/app/dictionary.svelte.ts` — the one label dictionary: `Terminology` (`'romaji' |
  'zh-hant'`), `TermKey` (20 entries), the term table, `term()`, `activeTerminology()`,
  `setTerminology()`, `windTerm()`. `romaji` values are exact copies of every string the views
  hardcoded before this ticket.

**Modified** (each a small, mechanical swap of a literal for a `term()`/`windTerm()` call —
see structure.md for the full per-file breakdown):
- `src/app/ClaimPrompt.svelte` — `callName()` and the win button's aria-label now share one
  dictionary-backed path instead of two independently hand-written literals.
- `src/app/RiichiPrompt.svelte` — the ask line's "tenpai"/"riichi" words, and the declare/
  decline buttons' text + aria-labels.
- `src/app/Table.svelte` — `SEATS.wind` (now `$derived` over `windTerm`, was a plain literal
  array), the furiten badge, the yakuless notice's "tsumo"/"riichi" words.
- `src/app/HandEnd.svelte` — dropped its local `WIND` const duplicate in favor of the shared
  `windTerm()`; ryuukyoku/tenpai/noten/dora/fu/han/next-hand.
- `src/app/App.svelte` — the pre-tenpai hint's "tenpai" word.

**Untouched, confirmed no vocabulary present:** `src/app/Tile.svelte`, `src/app/drive.ts`,
`src/app/main.ts`, all of `src/core/`.

7 commits, one per plan.md step (Step 7's grep audit + build check needed no code change, so
no commit for it).

## Test coverage

- The entire existing suite (35 files, 903 tests) passes unchanged after every commit — this
  IS the ticket's acceptance criterion ("with the default terminology every existing SSR/drive
  test passes unchanged"), verified incrementally rather than only at the end.
- `just check` (svelte-check + tsc) and `just build` (single-file gate, 103.6 kB) both pass.
- A manual grep audit (plan.md Step 7) found zero hardcoded occurrences of the nine named
  romanized terms or their CJK forms in `src/app/*.svelte` outside the dictionary module
  itself and correctly-excluded categories: TS comments, string-literal type comparisons
  (`win.type === 'tsumo'`), CSS class selectors (`.tenpai`, `.furiten`), the riichi-stakes
  prose (Decision 2, explicitly deferred), and `Tile.svelte`'s honor-tile art glyphs (東南西北
  as physical tile faces, unrelated to seat/wind labeling — different concept entirely).

**Gap — no automated enforcement of the grep audit.** The AC says "grep-checkable," which this
satisfies literally (a human or CI step CAN grep and find nothing), but nothing in the repo
runs that grep automatically. A regression (someone hardcoding a new "riichi" string in a
future PR) would not be caught by any test today. Not fixed here — encoding it as a real test
would mean picking a specific word list and file scope, which risks becoming its own small
ticket; flagging for the team to decide whether T-010-01-03's dual-terminology suite should
absorb this instead of a separate lint-style check.

**Gap — the `zh-hant` path is entirely untested.** By design (T-010-01-03 owns the
parameterized dual-terminology suite), no test in this ticket ever calls `setTerminology('zh-
hant')` or renders anything under it. The Traditional Chinese strings in the term table have
not been exercised by any test, snapshot, or render — only proofread by me while writing them.

## Open concerns for human attention

1. **The `zh-hant` term values are my own choices, not sourced from a native speaker or the
   product owner**, beyond the nine terms the ticket itself named literally (吃/碰/槓/胡/自摸/
   立直/流局/聽牌/振聽) and the four wind kanji (東南西北). `noten` (未聽), `declareRiichi`
   (宣告立直), `notYet` (暫不), `dora` (寶牌), `fu` (符), `han` (翻), `nextHand` (下一局) are
   reasonable picks but unverified — worth a native-speaker pass before T-010-01-03 locks them
   into an asserted test suite.
2. **The furiten badge's visible default text changed** (Decision 6): it used to hardcode `振
   聴` (Japanese orthography, mismatched with the ticket's own Traditional 聽) unconditionally;
   it now shows the word `furiten` under the default `romaji` terminology. No existing test
   asserted the old glyph, so nothing broke, but this IS a visible behavior change to the
   currently-shipped app, not merely an internal refactor — flagging explicitly since the
   ticket's own AC framing ("tests pass unchanged") technically allows it but a reviewer
   scanning only the diff summary might not expect a rendering change from a "wire the
   dictionary through" ticket.
3. **Mixed-language surfaces remain by design, not oversight**: the riichi-stakes three
   bullets, the yakuless notice's "no yaku" phrasing, `HandEnd`'s yaku-name list
   (`breakdown.yaku[i].name`, core data) and `limitName` (also core data) stay English-only
   under `zh-hant` — this is Decision 2/7's explicit scope boundary (full-sentence prose
   translation and core-authored data are out of scope), not a bug, but a `zh-hant` user will
   see a genuinely mixed-language hand-end screen until a later ticket (not yet scheduled)
   tackles yaku-name/limit-name translation and stakes-prose localization.
4. **`activeTerminology()`/`setTerminology()` are currently dead code** from the running app's
   perspective — nothing calls `setTerminology`, so `zh-hant` is unreachable until T-010-01-02
   adds the toggle. Expected per the story's ticket sequence, not a defect.

## Nothing else outstanding

No TODOs left in the touched files; no deviations beyond the two noted in progress.md (import
extension, `windTerm`'s widened parameter type), both resolved before their commits landed.
