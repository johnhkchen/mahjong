# Design — T-010-01-01 term-dictionary-and-wiring

## Decision 1 — One `.svelte.ts` module, reactive terminology from day one

A single new file, `src/app/dictionary.svelte.ts`, holds: the `Terminology` union, the term
table, a reactive "current terminology" `$state`, and a `term(key)` reader. Runes only work in
`.svelte`/`.svelte.ts`/`.svelte.js` files, so the reactive state forces the `.svelte.ts`
extension on the whole module — the term table and `term()` live there too rather than
splitting into a second plain `.ts` file, matching the ticket's "one dictionary module" ask.

**Rejected: plain `.ts` module + prop-drilled terminology.** Threading a `terminology` prop
through `App → Table → HandEnd` and `App → ClaimPrompt`/`RiichiPrompt` works today but forces
T-010-01-02 to re-touch every one of those component signatures again to add the toggle. A
module-level `$state` read directly by every consumer (Svelte 5's supported pattern for
cross-component reactive state without prop-drilling or a context) means T-010-01-02 only adds
a setter call on click plus a `localStorage` read/write `$effect` — zero changes to the
components this ticket touches. This is the entire reason to spend the `.svelte.ts` extension
now even though nothing mutates the state yet.

**Rejected: Svelte context (`setContext`/`getContext`).** Context requires every consumer to be
a descendant of a provider component mounted at the same tree — true today, but adds ceremony
(`getContext` calls in every file) for no benefit over a module-scoped rune here, since the app
has exactly one instance of the whole tree (no multi-table, no server-rendered-per-request
isolation concern — SSR renders once per test's `render()` call, and module-level state resets
per test file/process the same way any other module singleton does).

## Decision 2 — Term-level dictionary, not phrase-level

Dictionary keys name single mahjong-vocabulary nouns/short controls, not full sentences:

```
chi, pon, kan, ron, tsumo, riichi, ryuukyoku, tenpai, noten, furiten,
east, south, west, north,
declareRiichi, notYet, nextHand,
dora, fu, han
```

Each maps to `{ romaji: string; 'zh-hant': string }`. Longer descriptive/teaching prose (the
riichi-stakes three bullets, the yakuless notice's connective sentence, "wins by … from …")
keeps its English scaffolding and connector words ("with", "from", "wins by", "—", "is sealed
on") literal in both terminologies; only the vocabulary words embedded in that prose route
through `term()`. Full-sentence translation (rephrasing grammar, not just swapping nouns) is
explicitly out of scope for this ticket.

**Rejected: whole-phrase keys** (e.g. a key for the entire yakuless sentence, keyed per
terminology). This would let a translator produce fully idiomatic Chinese grammar instead of
"noun-swapped-into-an-English-sentence-shape" output, which is a real quality gap — flagged as
a known limitation in review.md — but phrase-level keys duplicate the same words the term-level
table already has (tenpai, riichi, tsumo all reappear inside the yakuless/stakes prose) and
multiply the surface a future editor must keep in sync. Term-level is the smaller, DRYer module
that still satisfies the acceptance criterion literally: grepping `src/app/*.svelte` for the
nine named CJK terms and the four wind kanji finds zero hardcoded hits.

## Decision 3 — Structural aria-labels stay literal; only vocabulary-bearing text is rewired

Landmarks used purely as internal region/selector ids — `"call or pass"`, `"riichi prompt"`,
`"mahjong table"`, `"dora indicator"`, `"your hand"`, `"drawn tile"`, `"winning tile"`, `"yaku"`
(list region), `"scores"`, `"tenpai"` (the ryuukyoku list's *region* label, distinct from the
per-seat tenpai/noten *values* inside it), `"points line"`, `"{area} pond"`, `"{area} melds"` —
are NOT in the ticket's example vocabulary (吃/碰/槓/胡/自摸/立直/流局/聽牌/振聽, seats,
"score-screen terms") and are not touched. They stay exactly as they render today, in both
terminologies. This is deliberate, not an oversight:

- It matches Table.svelte's own existing comment that pond/meld labels are "a distinct aria
  vocabulary from the wind display names" — already decoupled from whatever word names the
  seat, so there is nothing to rewire there by the component's own established contract.
- It keeps every DOM-selector-based test (`app.riichi.tap.svelte.test.ts` queries
  `'[aria-label="declare riichi"]'`/`'[aria-label="not yet"]'` — see Decision 4 — and every
  `aria-label="…"` substring check across `app.ssr.test.ts`) working unchanged for BOTH
  terminologies where the label is structural, and unchanged for the DEFAULT terminology where
  the label is vocabulary-bearing.
- "Grep-checkable" in the acceptance criterion is satisfied against the ticket's named
  vocabulary; `"call"`/`"pass"`/`"yaku"`/`"scores"`/`"points"` are generic UI/English words the
  ticket never names as translatable, so leaving them is consistent with the letter of the AC,
  not a loophole in it.

**Visible per-seat values inside the tenpai/noten list ARE rewired** (`tenpai`/`noten` are named
vocabulary), even though the list's own wrapping `aria-label="tenpai"` is not — the region id
and its contents are independent surfaces.

## Decision 4 — `declareRiichi`/`notYet` default values are pinned by a DOM-selector test

`app.riichi.tap.svelte.test.ts` clicks `target.querySelector('[aria-label="declare riichi"]')`
and `'[aria-label="not yet"]'` — not just text-matches them. `term('declareRiichi', 'romaji')`
and `term('notYet', 'romaji')` MUST equal `'declare riichi'` and `'not yet'` byte-for-byte, and
both the button's visible text and its `aria-label` route through the same `term()` call (one
call per button, used twice) so they can never drift apart from each other or from the pinned
default.

## Decision 5 — Consolidate `callName`'s duplicated ron/tsumo branch

`ClaimPrompt.svelte` currently has two independent literal branches for the win button: `<span
class="name">{callName(win.type)}</span>` (delegates to `callName`, which passes `tsumo`/`ron`
through verbatim) and a separately hand-written aria-label ternary (`win.type === 'ron' ? 'ron
…' : 'tsumo'`). Rewiring both through `term()` collapses to one call each; `callName` becomes
`term(type === 'daiminkan' ? 'kan' : type)` and the aria-label ternary becomes
`callName(win.type)` reused, removing the duplicated literal. This is incidental cleanup that
falls directly out of the rewire, not scope creep — the two spots must resolve to the same
word by construction once both go through the dictionary.

## Decision 6 — Fix the furiten badge's stray Japanese-orthography glyph

The current furiten badge hardcodes `振聴` (using Japanese shinjitai 聴), not the ticket's own
Traditional 聽, and shows it unconditionally regardless of terminology — a pre-existing
inconsistency from T-009-03-02, written before this ticket's two-terminology framing existed.
Rewiring it to `{term('furiten')}` fixes both problems at once: default (`romaji`) terminology
now shows the word `furiten` (matching "romanized Japanese, the default" framing, and matching
every other term's default rendering style), and `zh-hant` shows the corrected `振聽`. No
existing test asserts the glyph itself (only the aria-label and the `"tsumo still wins"` tail
are checked), so this is a safe, in-scope correction, not a breaking change — called out
explicitly in review.md since it does change what today's default render shows, just not in a
way any test observes.

## Decision 7 — `fu`/`han`/`dora` get entries; `limitName` and yaku `name`s do not

`fu`, `han`, and `dora` are unit words the app itself writes into the score line (`{fu}fu
{han}han {points}`, `dora {doraHan}`) — "score-screen terms," explicitly in the ticket's scope
phrase. `breakdown.limitName` (`'mangan'`/`'haneman'`/`'yakuman'`/…) and `breakdown.yaku[i].name`
(`'menzen-tsumo'`/`'pinfu'`/…) are core-authored strings (`src/core/settlement.ts`) consumed
verbatim by `HandEnd.svelte` — never hardcoded in a component, so out of scope by the AC's own
"hardcoded in a component" wording, and correctly untouched per "core stays byte-for-byte
untouched." Translating those tables is a distinct, much larger effort the ticket's example
vocabulary never names.

## Summary of the wire-up

| File | Hardcoded today | Routed through |
|---|---|---|
| `ClaimPrompt.svelte` | `callName()`'s literal passthrough + win aria-label ternary | `term(callForm)` |
| `RiichiPrompt.svelte` | "tenpai"/"riichi" inside the ask line; "declare riichi"/"not yet" buttons | `term('tenpai')`/`term('riichi')`/`term('declareRiichi')`/`term('notYet')` |
| `Table.svelte` | `SEATS` wind names; furiten badge; yakuless notice's "tsumo"/"riichi" words | `term('east'\|'south'\|'west'\|'north')`; `term('furiten')`/`term('ron')`/`term('tsumo')`; `term('tsumo')`/`term('riichi')` |
| `HandEnd.svelte` | local `WIND` const; "ryuukyoku"; tenpai/noten values; "dora"; "fu"/"han"; "next hand" | shared wind lookup from the dictionary (replacing the duplicated local `WIND`); `term(...)` for each |
| `App.svelte` | "tenpai" inside the shanten hint | `term('tenpai')` |

`Tile.svelte`, `drive.ts`, `main.ts`: untouched (confirmed no vocabulary lives there, research.md).
`src/core/`: untouched.
