# Structure — T-010-01-01 term-dictionary-and-wiring

## New file: `src/app/dictionary.svelte.ts`

The one dictionary module (Decision 1). Public surface:

```ts
export type Terminology = 'romaji' | 'zh-hant'

export type TermKey =
  | 'chi' | 'pon' | 'kan' | 'ron' | 'tsumo' | 'riichi' | 'ryuukyoku'
  | 'tenpai' | 'noten' | 'furiten'
  | 'east' | 'south' | 'west' | 'north'
  | 'declareRiichi' | 'notYet' | 'nextHand'
  | 'dora' | 'fu' | 'han'

/** Reads the app-wide active terminology (module-scoped $state, Decision 1). */
export function term(key: TermKey): string

/** The active terminology itself — read by a future toggle UI (T-010-01-02). */
export function activeTerminology(): Terminology

/** Sets the active terminology — called by a future toggle (T-010-01-02); unused by
 *  any consumer in THIS ticket, but exported now so T-010-01-02 adds zero exports here. */
export function setTerminology(next: Terminology): void

/** Wind-term lookup by engine Seat index (0=E,1=S,2=W,3=N) — the shared replacement
 *  for Table.svelte's SEATS wind names and HandEnd.svelte's local WIND const. */
export function windTerm(seat: 0 | 1 | 2 | 3): string
```

Internals: one `const TERMS: Record<TermKey, Record<Terminology, string>>` literal (the 19
entries enumerated in design.md's table below), one `let current = $state<Terminology>('romaji')`,
and `term()`/`activeTerminology()`/`setTerminology()`/`windTerm()` as thin reads/writes over
those two. No imports from `../core` needed — `windTerm`'s parameter is a plain `0|1|2|3`
literal union, not core's `Seat` (avoids a dependency for four numbers; core's `Seat` is
structurally identical so callers passing a real `Seat` value typecheck without a cast).

Full term table (default `romaji` values are copied verbatim from today's hardcoded strings —
this is what keeps every existing test passing unchanged):

| key | romaji (default, = today's hardcoded value) | zh-hant |
|---|---|---|
| chi | `chi` | `吃` |
| pon | `pon` | `碰` |
| kan | `kan` | `槓` |
| ron | `ron` | `胡` |
| tsumo | `tsumo` | `自摸` |
| riichi | `riichi` | `立直` |
| ryuukyoku | `ryuukyoku` | `流局` |
| tenpai | `tenpai` | `聽牌` |
| noten | `noten` | `未聽` |
| furiten | `furiten` | `振聽` |
| east | `East` | `東` |
| south | `South` | `南` |
| west | `West` | `西` |
| north | `North` | `北` |
| declareRiichi | `declare riichi` | `宣告立直` |
| notYet | `not yet` | `暫不` |
| nextHand | `next hand` | `下一局` |
| dora | `dora` | `寶牌` |
| fu | `fu` | `符` |
| han | `han` | `翻` |

## Modified: `src/app/ClaimPrompt.svelte`

- Import `term` from `./dictionary.svelte.ts`.
- `callName()` body becomes `return term(type === 'daiminkan' ? 'kan' : type)` (types
  `'chi'|'pon'|'daiminkan'|'tsumo'|'ron'` all map onto existing `TermKey`s of the same name).
- The win button's aria-label ternary (`win.type === 'ron' ? \`ron ${kindOf(win.tile)}\` :
  'tsumo'`) becomes `win.type === 'ron' ? \`${callName('ron')} ${kindOf(win.tile)}\` :
  callName('tsumo')` — reuses `callName` instead of a second hand-written literal (Decision 5).
- `"call on … ?"`, `"pass"`, `"call or pass"` landmark: untouched (Decision 3 — not in the
  ticket's named vocabulary, structural/generic).

## Modified: `src/app/RiichiPrompt.svelte`

- Import `term`.
- Ask line: `you're tenpai — declare riichi with <Tile id={tile} />?` becomes `you're
  {term('tenpai')} — declare {term('riichi')} with <Tile id={tile} />?`.
- Stakes bullets: untouched (Decision 2 — descriptive prose, out of scope; they still mention
  "riichi"/"yaku" in English prose, a documented limitation, not a ticket regression).
- Declare button: text `declare riichi` → `{term('declareRiichi')}`; `aria-label="declare
  riichi"` → `aria-label={term('declareRiichi')}`.
- Decline button: text `not yet` → `{term('notYet')}`; `aria-label="not yet"` →
  `aria-label={term('notYet')}`.
- `aria-label="riichi prompt"` landmark: untouched (Decision 3).

## Modified: `src/app/Table.svelte`

- Import `term`, `windTerm` from `./dictionary.svelte.ts`.
- `SEATS` const: `wind: 'East'` etc. become `wind: windTerm(0)` etc. — `SEATS` stops being a
  top-level `const` array literal and becomes a `$derived` (Svelte 5 rune) array built the same
  shape, so it re-evaluates if terminology ever changes (T-010-01-02's concern; this ticket only
  needs it to read the CURRENT value correctly, but building it as `$derived` now means
  T-010-01-02 needs no further change here). `pond`/`area`/`you` fields unchanged (Decision 3 —
  the existing lowercase `area` strings already are "a distinct aria vocabulary," untouched).
- Furiten badge: `振聴 — ron is sealed on <Tile .../>; tsumo still wins` becomes `{term('furiten')}
  — {term('ron')} is sealed on <Tile .../>; {term('tsumo')} still wins` (Decision 6).
- Yakuless notice: `no yaku — this hand can only win by tsumo; riichi would fix this` becomes
  `no yaku — this hand can only win by {term('tsumo')}; {term('riichi')} would fix this` — "yaku"
  itself stays literal (Decision 7 rationale extended to this generic-in-prose usage; it names no
  specific vocabulary entry and isn't in the ticket's list).
- `aria-label="furiten"`, `aria-label="yakuless tenpai"`, `aria-label="{area} pond"`,
  `aria-label="{area} melds"`, `aria-label="your hand"`, `aria-label="drawn tile"`,
  `aria-label="mahjong table"`, `aria-label="dora indicator"`: untouched (Decision 3).
- `{table.live.length} tiles left`: untouched — "tiles left" isn't in the ticket's vocabulary.

## Modified: `src/app/HandEnd.svelte`

- Import `windTerm` from `./dictionary.svelte.ts`; delete the local `const WIND = ['East',
  'South', 'West', 'North'] as const` and every `WIND[seat]` becomes `windTerm(seat)` (this
  removes the duplication the file's own comment calls out as precedent — see research.md).
- Import `term`.
- `ryuukyoku — exhaustive draw` → `{term('ryuukyoku')} — exhaustive draw`.
- Per-seat tenpai list: `{isTenpai ? 'tenpai' : 'noten'}` → `{isTenpai ? term('tenpai') :
  term('noten')}` (the wrapping `aria-label="tenpai"` region label stays literal — Decision 3).
- `{WIND[breakdown.winner]}… wins by {breakdown.by}{… from ${WIND[breakdown.from]}}` →
  `windTerm(breakdown.winner)… wins by {breakdown.by === 'ron' ? term('ron') : term('tsumo')}…
  from {windTerm(breakdown.from)}`. (`breakdown.by` is core's own `'ron'|'tsumo'` discriminant —
  translating its rendered word is in scope the same way `win.type` was in ClaimPrompt.)
- `{breakdown.doraHan > 0}`: `dora {breakdown.doraHan}` → `{term('dora')} {breakdown.doraHan}`.
- Points line: `{limitName} {points}` branch untouched (`limitName` is core data — Decision 7);
  `{fu}fu {han}han {points}` → `{fu}{term('fu')} {han}{term('han')} {points}`.
- `{WIND[seat]}: {score}` (scores list) → `{windTerm(seat)}: {score}`.
- `next hand` button text → `{term('nextHand')}`.
- `{line.name} {line.han}han` (yaku list): untouched — `line.name` is core data (Decision 7);
  the bare `han` suffix here is a literal string in the current file, not routed through the
  dictionary's `han` term, because it is glued directly onto core-authored yaku data the same
  way `limitName` is — kept as-is to avoid a half-translated `{line.name} {line.han}翻` chimera
  when `line.name` itself stays English. Noted as an inconsistency to flag in review.md.

## Modified: `src/app/App.svelte`

- Import `term` from `./dictionary.svelte.ts`.
- Hint line: `{hint} away from tenpai` → `{hint} away from {term('tenpai')}`.
- Header `mahjong` / `new-game` button text: untouched (Decision 3 — brand name / generic UI
  action, not in the ticket's vocabulary).

## Ordering

1. Write `dictionary.svelte.ts` first (no dependents yet, fully self-contained, unit-testable
   in isolation if desired — though no new test file is planned; existing SSR/tap suites are
   the regression net, per plan.md).
2. Wire `ClaimPrompt.svelte` and `RiichiPrompt.svelte` (leaf, no cross-file wind dependency).
3. Wire `Table.svelte` (introduces `windTerm`).
4. Wire `HandEnd.svelte` (consumes `windTerm`, removes its local `WIND` duplicate).
5. Wire `App.svelte` (single one-line change, last since it's the smallest and least risky).

Each step is independently runnable against the full existing test suite — no step depends on
a later one for correctness, only `windTerm`'s existence (step 1) is a prerequisite for 3–4.
