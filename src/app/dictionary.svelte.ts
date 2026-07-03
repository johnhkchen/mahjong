// The one label dictionary (T-010-01-01): every user-facing MAHJONG-VOCABULARY word in the
// views, in the two supported terminologies. Romanized Japanese (`romaji`) is the default and
// exactly matches every string the views hardcoded before this ticket — that is what keeps the
// whole existing SSR/tap/drive test suite passing unchanged. `zh-hant` is Traditional Chinese.
// Deliberately NOT in here: generic UI words no ticket ever named as translatable ("call",
// "pass", "yaku" used loosely in prose, "new game", "next hand"'s neighbors like "scores"),
// core-authored data (yaku `name`s, `limitName`s — src/core/ output, never hardcoded here to
// begin with), and full-sentence prose (the riichi-stakes bullets, the yakuless notice's
// connective grammar) — only the vocabulary NOUNS embedded in that prose route through `term()`,
// the sentence shape itself stays English scaffolding in both terminologies (design.md
// Decision 2). See docs/active/work/T-010-01-01/design.md for the full rationale.

export type Terminology = 'romaji' | 'zh-hant'

export type TermKey =
  | 'chi'
  | 'pon'
  | 'kan'
  | 'ron'
  | 'tsumo'
  | 'riichi'
  | 'ryuukyoku'
  | 'tenpai'
  | 'noten'
  | 'furiten'
  | 'east'
  | 'south'
  | 'west'
  | 'north'
  | 'declareRiichi'
  | 'notYet'
  | 'nextHand'
  | 'dora'
  | 'fu'
  | 'han'

const TERMS: Record<TermKey, Record<Terminology, string>> = {
  chi: { romaji: 'chi', 'zh-hant': '吃' },
  pon: { romaji: 'pon', 'zh-hant': '碰' },
  kan: { romaji: 'kan', 'zh-hant': '槓' },
  ron: { romaji: 'ron', 'zh-hant': '胡' },
  tsumo: { romaji: 'tsumo', 'zh-hant': '自摸' },
  riichi: { romaji: 'riichi', 'zh-hant': '立直' },
  ryuukyoku: { romaji: 'ryuukyoku', 'zh-hant': '流局' },
  tenpai: { romaji: 'tenpai', 'zh-hant': '聽牌' },
  noten: { romaji: 'noten', 'zh-hant': '未聽' },
  furiten: { romaji: 'furiten', 'zh-hant': '振聽' },
  east: { romaji: 'East', 'zh-hant': '東' },
  south: { romaji: 'South', 'zh-hant': '南' },
  west: { romaji: 'West', 'zh-hant': '西' },
  north: { romaji: 'North', 'zh-hant': '北' },
  declareRiichi: { romaji: 'declare riichi', 'zh-hant': '宣告立直' },
  notYet: { romaji: 'not yet', 'zh-hant': '暫不' },
  nextHand: { romaji: 'next hand', 'zh-hant': '下一局' },
  dora: { romaji: 'dora', 'zh-hant': '寶牌' },
  fu: { romaji: 'fu', 'zh-hant': '符' },
  han: { romaji: 'han', 'zh-hant': '翻' },
}

// Module-scoped rune, not prop-drilled or context-provided (design.md Decision 1): every
// consumer reads `term()`/`windTerm()` directly, so a future toggle (T-010-01-02) only needs to
// call `setTerminology()` on click plus a `localStorage` read/write effect — no consumer here
// changes again.
let current = $state<Terminology>('romaji')

/** The active terminology's rendering of `key`. */
export function term(key: TermKey): string {
  return TERMS[key][current]
}

/** The active terminology itself — read by a future toggle UI's own display state. */
export function activeTerminology(): Terminology {
  return current
}

/** Sets the active terminology. Unused by any consumer in this ticket; exported for T-010-01-02. */
export function setTerminology(next: Terminology): void {
  current = next
}

const SEAT_TERMS: readonly TermKey[] = ['east', 'south', 'west', 'north']

/** The wind term for engine Seat index (0=E, 1=S, 2=W, 3=N) — shared by Table.svelte and
 *  HandEnd.svelte in place of each holding its own local wind-name array. */
export function windTerm(seat: 0 | 1 | 2 | 3): string {
  return term(SEAT_TERMS[seat])
}
