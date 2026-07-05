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
  | 'pot'
  | 'promptEveryCall'
  | 'quietCalls'
  | 'reportBug'
  | 'copyReport'
  | 'openIssue'
  | 'reportMessage'
  | 'reportCopied'
  | 'loadReport'
  | 'pasteReport'

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
  // The riichi-stick pot riding the table between hands (supplied sticks, 供託).
  pot: { romaji: 'riichi pot', 'zh-hant': '供託' },
  // T-012-01-02's call-prompt-filter toggle — the header button always names the
  // mode a tap switches TO (App.svelte's own convention, echoing TERMINOLOGY_LABEL).
  promptEveryCall: { romaji: 'prompt every call', 'zh-hant': '提示每次叫牌' },
  quietCalls: { romaji: 'quiet calls', 'zh-hant': '安靜叫牌' },
  // T-013-02-01's report-bug dialog — the dialog's own chrome only (heading, both
  // delivery buttons, the message field's label); the report body itself (context
  // block + notation) is deliberately English scaffolding for the maintainer, never
  // routed through term() (design.md Decision 4).
  reportBug: { romaji: 'report bug', 'zh-hant': '回報問題' },
  copyReport: { romaji: 'copy report', 'zh-hant': '複製回報' },
  openIssue: { romaji: 'open issue', 'zh-hant': '開啟議題' },
  reportMessage: { romaji: 'message', 'zh-hant': '訊息' },
  reportCopied: { romaji: 'copied', 'zh-hant': '已複製' },
  // T-013-02-02's paste-to-reproduce loader — the owner's half of E-013, living
  // inside this same dialog (design.md Decision 1).
  loadReport: { romaji: 'load report', 'zh-hant': '載入回報' },
  pasteReport: { romaji: 'paste report', 'zh-hant': '貼上回報' },
}

const STORAGE_KEY = 'mahjong-terminology'

function isTerminology(value: string | null): value is Terminology {
  return value === 'romaji' || value === 'zh-hant'
}

/** Reads the persisted terminology at module load — the "read at boot" the toggle
 *  (T-010-01-02) needs. Guarded on `window`, not `localStorage`, directly: the Node
 *  test project (app.ssr.test.ts) runs plain Node, where `globalThis.localStorage`
 *  is itself an accessor that emits an ExperimentalWarning the instant it's read
 *  (even via `typeof`) — gating on `window`'s plain absence never touches that
 *  accessor at all, so no warning fires. A malformed/foreign stored value falls
 *  back to the default rather than throwing. */
function loadStored(): Terminology {
  if (typeof window === 'undefined') return 'romaji'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isTerminology(stored) ? stored : 'romaji'
}

// Module-scoped rune, not prop-drilled or context-provided (design.md Decision 1): every
// consumer reads `term()`/`windTerm()` directly, so App.svelte's toggle (T-010-01-02) only
// needed a setter call on click plus the guarded localStorage read/write below — no consumer
// here changed again.
let current = $state<Terminology>(loadStored())

/** The active terminology's rendering of `key`. */
export function term(key: TermKey): string {
  return TERMS[key][current]
}

/** The active terminology itself — read by App.svelte's toggle for its own display state. */
export function activeTerminology(): Terminology {
  return current
}

/** Sets the active terminology and persists the choice to the one storage key
 *  (T-010-01-02). Guarded the same way loadStored() is — a no-op write under the
 *  Node test project, never throws and never warns. */
export function setTerminology(next: Terminology): void {
  current = next
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
}

const SEAT_TERMS: readonly TermKey[] = ['east', 'south', 'west', 'north']

/** The wind term for engine Seat index (0=E, 1=S, 2=W, 3=N) — shared by Table.svelte and
 *  HandEnd.svelte in place of each holding its own local wind-name array. Takes `number`
 *  rather than core's narrower `Seat` type: `#each` block indices in the callers' templates
 *  are plain `number`, and every caller only ever passes a real 0-3 seat index. */
export function windTerm(seat: number): string {
  return term(SEAT_TERMS[seat])
}

const CALL_TERM_KEYS: Record<'chi' | 'pon' | 'daiminkan' | 'ron' | 'tsumo', TermKey> = {
  chi: 'chi',
  pon: 'pon',
  daiminkan: 'kan',
  ron: 'ron',
  tsumo: 'tsumo',
}

/** A claim/win type's table name — a daiminkan is called "kan" at the table (the
 *  record's own discriminant is untouched; this is display only). Shared by
 *  ClaimPrompt (the call/pass buttons) and WindowNotice (T-011-02-01's outcome
 *  notice) so the same call type always reads as the same word in both places,
 *  under either terminology. */
export function callTerm(type: 'chi' | 'pon' | 'daiminkan' | 'ron' | 'tsumo'): string {
  return term(CALL_TERM_KEYS[type])
}
