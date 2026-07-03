# Research — T-010-01-01 term-dictionary-and-wiring

## Scope recap

One dictionary module in `src/app/` covering every user-facing *mahjong* term in two
terminologies — romanized Japanese (current labels, default) and Traditional Chinese — with
every hardcoded occurrence in the views rewired through it. `src/core/` is untouched (it never
emits English/Chinese labels; it emits typed discriminants like `'chi' | 'pon' | 'daiminkan'`,
`WindKind` = `'1z'..'4z'`, yaku `name` strings like `'menzen-tsumo'`, `'pinfu'`). All display
vocabulary — call names, win names, wind names, riichi/tenpai/furiten/ryuukyoku prose, score
labels — originates in `src/app/`.

## Files in scope (src/app/)

- `App.svelte` — header, new-game button, the pre-tenpai hint line.
- `ClaimPrompt.svelte` — call/pass/win console: `callName()` maps `daiminkan → 'kan'`,
  passes through `chi`/`pon`/`tsumo`/`ron` verbatim; several aria-labels built from these.
- `RiichiPrompt.svelte` — the riichi console: question text, three stake bullets, two
  buttons (`declare riichi` / `not yet`).
- `Table.svelte` — `SEATS` const (wind display names `East/South/West/North`, pond aria
  labels `east pond`/etc., lowercase and explicitly a "distinct aria vocabulary" per its own
  comment), the furiten badge (`振聴 — ron is sealed on …; tsumo still wins`, note: uses the
  Japanese glyph 聴, not the ticket's Traditional 聽), the yakuless notice (`no yaku — this
  hand can only win by tsumo; riichi would fix this`).
- `HandEnd.svelte` — local `WIND` const (duplicate of Table's, "no cross-file export"
  precedent already established for `.svelte` files), `ryuukyoku`/`tenpai`/`noten` labels,
  `wins by {by} from {WIND}`, yaku list (`{line.name} {line.han}han` — `line.name` is CORE
  data, out of scope), `dora {n}`, `{fu}fu {han}han {points}` / `{limitName} {points}`,
  `{WIND}: {score}`, `next hand` button.
- `Tile.svelte` — renders `kindOf`/tile-art only; the visually-hidden `.kind` span emits the
  raw `TileId` kind string (`'1z'`, `'3p'`, …) which SSR tests match directly — explicitly
  documented as never emitting "an English wind word." Out of scope: no English/Chinese
  vocabulary lives here, and its own comment forbids adding any.
- `drive.ts` — pure selectors, returns `HandAction` elements and typed unions; emits no
  display strings. Out of scope.
- `main.ts` — no UI text.

Ticket's example vocabulary: 吃(chi) 碰(pon) 槓(kan) 胡(ron/win-by-discard) 自摸(tsumo)
立直(riichi) 流局(ryuukyoku) 聽牌(tenpai) 振聽(furiten), seats 東南西北, "score-screen terms."

## What existing tests pin down (the "unchanged in default terminology" constraint)

`app.ssr.test.ts` (630 lines) and the four `.svelte.test.ts` files assert exact strings —
these are the default-terminology contract:

- Wind names as exact single-word matches (count via `body.split(wind).length`): `East`,
  `South`, `West`, `North` — appearing exactly once each in the SSR boot fixture.
- Aria-label landmarks used as literal strings AND as DOM query selectors:
  `aria-label="call or pass"`, `aria-label="riichi prompt"`, `aria-label="mahjong table"`,
  `aria-label="dora indicator"`, `aria-label="your hand"`, `aria-label="{seat} pond"`,
  `aria-label="{seat} melds"`, `aria-label="winning tile"`, `aria-label="yaku"`,
  `aria-label="scores"`, `aria-label="tenpai"`, `aria-label="points line"`,
  `aria-label="furiten"`, `aria-label="yakuless tenpai"`, `aria-label="drawn tile"`.
- Aria-labels built from call/win vocabulary, asserted verbatim: `"pon 3p with 3p 3p"`,
  `"chi 3p with 2p 4p"`, `"kan 8s with 8s 8s 8s"`, `"ron 8m"`, `"tsumo"`, `"pass"`,
  `"discard {kind}"`, `"claimed {kind} from {area}"`.
- **`app.riichi.tap.svelte.test.ts` queries the DOM by these exact aria-labels as CSS
  selectors**: `'[aria-label="declare riichi"]'`, `'[aria-label="not yet"]'` — these two
  strings are load-bearing beyond text-matching; whatever key names them must resolve to
  these literal values under default terminology or this test breaks.
- Prose asserted after whitespace-collapse: `"East (you) wins by tsumo"`,
  `"North wins by ron from East"`.
- Prose asserted verbatim: `"you're tenpai"`, `"declare riichi with"` (RiichiPrompt's ask
  line), `"tsumo still wins"` (furiten badge tail), `"no yaku — this hand can only win by
  tsumo; riichi would fix this"` (yakuless notice, full sentence), `"ryuukyoku — exhaustive
  draw"`, `"tenpai"`/`"noten"` per-seat labels, `"next hand"` button text, `"{n} tiles left"`.
- The furiten badge's leading glyph (`振聴`) is NOT asserted by any test — only its tail
  (`"tsumo still wins"`) and the aria-label are. This glyph is free to change.
- `"new game"` button text is not asserted anywhere by string match (only clicked via a
  `.new-game` class selector in other tests, unconfirmed — not grepped here but no test file
  matched it in the earlier search). Low risk either way.

## Existing precedent for per-file constant duplication

`HandEnd.svelte`'s own comment: "a `.svelte` file exports no values another component can
import; the `windKindOf`-across-three-core-files precedent applies here too" — i.e. Table.svelte
and HandEnd.svelte already each hold their own local `WIND` array rather than sharing one,
because Svelte components don't export plain values to each other. A dictionary module living
in a plain `.ts` (or `.svelte.ts`) file does NOT have this restriction — it can be imported
by any `.svelte` file normally. This removes the duplication precedent going forward for wind
names specifically, since both components can import one shared source instead.

## Svelte 5 runes constraint

The project's stack is Svelte 5 with runes (`$state`/`$derived`), per CLAUDE.md and
architecture.md. Runes are usable in any `.svelte.ts` file, not only `.svelte` components —
this is how a future live-toggle (T-010-01-02, out of scope here but the dictionary's shape
must accommodate it) can hold reactive terminology-selection state in a plain module that many
components import directly, without prop-drilling through App → Table → HandEnd/ClaimPrompt/
RiichiPrompt. No such module exists yet in `src/app/`.

## What T-010-01-02 and T-010-01-03 already commit to (adjacent tickets, not this one)

- T-010-01-02: a header toggle switches terminology live, persisted to exactly one
  `localStorage` key, read at boot, SSR-safe (no toggle logic, no localStorage read needed in
  *this* ticket — but the dictionary's public shape must let a later toggle mutate the active
  terminology and have every consumer re-render).
- T-010-01-03: a parameterized test suite renders key surfaces under both terminologies and
  checks labels like `吃/碰/槓/胡/自摸/tsumo` — confirms the dictionary needs real entries for
  the call/win vocabulary in both terminologies now, even though this ticket only wires the
  default terminology through.

## Yaku names are out of scope

`scoreBreakdownOf(table).yaku[i].name` (e.g. `'menzen-tsumo'`, `'pinfu'`) is CORE-authored data
consumed verbatim by `HandEnd.svelte` — never hardcoded in `src/app/`. The ticket's acceptance
criterion ("no user-facing game term remains hardcoded in a **component**") does not reach data
that originates in `core/`. Translating the ~40-entry yaku name table is a distinct, much larger
effort not implied by this ticket's example vocabulary list (which omits yaku names entirely).

## Open questions for Design

1. Granularity: term-level dictionary keyed by semantic id (`chi`, `pon`, `riichi`, `east`,
   `tenpai`, …) vs. whole-phrase keys (`"declare riichi with"`, `"no yaku — this hand can only
   win by tsumo; riichi would fix this"`). Connector words ("with", "from", "wins by") are not
   in the ticket's example vocabulary — likely stay literal English scaffolding around
   term-level slots, not full sentence translation.
2. Whether structural/landmark aria-labels that happen to spell an English game word (e.g.
   `aria-label="{seat} pond"`, `aria-label="{seat} melds"`, `aria-label="yaku"`,
   `aria-label="tenpai"` list-region, `aria-label="points line"`) are "game terms" to rewire, or
   internal, stable landmark ids that should stay constant across terminologies (test-safety
   argument: keeping them constant means fewer moving parts and zero risk to DOM-selector-based
   tests like the riichi tap suite).
3. How the reactive terminology-selection point is shaped so T-010-01-02 can wire a toggle +
   `localStorage` onto it without this ticket re-touching every consumer again.
4. What to do with the existing hardcoded `振聴` glyph in the furiten badge (currently the
   Japanese orthographic form, not the ticket's Traditional 聽) — no test pins its presence.
