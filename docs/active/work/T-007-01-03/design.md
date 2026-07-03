# T-007-01-03 — man-numbered-faces — Design

## The decision in one paragraph

Replace only the `m` arm of Tile.svelte's interim numbered branch with the real
man face: two stacked engraved SVG `<text>` glyphs on the settled chassis — the
kanji rank numeral (一二三四五六七八九, from a module-level `MAN_RANKS` lookup)
large in the upper face, and the 萬 mark beneath it — using the engraving
treatment the honors established (fill + hairline same-color stroke, serif CJK
stack). Colors follow the Taiwan convention the owner directed: numeral in the
established ink-blue `#2e5aa0`, 萬 in the established red `#a03c2e`. The p/s arms
of the interim branch stay byte-identical (they are T-007-01-02's canvas), the
kind-token contract is untouched, and coverage lands as an additive `man faces`
describe block in tile.ssr.test.ts pinning numeral + 萬 presence and numeral
exclusivity. No consumer, no core file, no dependency, no config moves.

## Decision 1 — glyph technology: platform-font SVG `<text>` (settled, inherited)

T-007-01-01 Decision 1 already chose SVG `<text>` over hand-authored paths and
shipped fonts, *explicitly on the strength of this ticket* ("scales to
T-007-01-03's 萬 kanji numerals"). 一–九 and 萬 are among the most common CJK
characters — platform coverage is safer than for 發, which already shipped. The
provenance invariant holds: Unicode script characters composed on an original
chassis, no commercial tile artwork. Not relitigated; the fallback (hand-authored
paths) remains reserved for playtest-discovered font failures.

## Decision 2 — composition: numeral over 萬, two text nodes, engraved

- **Chosen:** the classic two-register man face. Rank numeral centered at x=30,
  baseline y=42, font-size 32 — filling the upper ~55% of the 54×74 ivory face.
  萬 centered at x=30, baseline y=70, font-size 24 — anchored to the lower
  register, clear of the face's bottom edge (y=76). Both get the honor engraving
  treatment: `fill` + same-color `stroke` at width 0.6 (a touch lighter than the
  honors' 0.75 — these glyphs are smaller and denser; 萬 at fs 24 with a 0.75
  stroke starts to clog). Same `.glyph` class, same serif CJK stack, weight 700.
- **Why these numbers:** the honor kanji sits alone at fs 40 / baseline 54; a man
  face divides that vertical budget two ways. fs 32 + fs 24 keeps the numeral
  clearly dominant (rank is what a player reads at a glance — P4) while 萬 stays
  a real character, not a footnote like the interim fs-18 mark. 一 at fs 32
  renders as a single wide bar — authentic, and its lightness is why engraving
  weight matters more than size here.
- **Rejected: single combined text node** (`一\n萬` or tspans). Two nodes is the
  established doctrine (regex-silence is structural, not incidental), lets the two
  registers take different sizes/colors, and avoids `<tspan>` entirely (design.md
  -01 noted tspans are merely *tolerated* by the region-slicing tests — simpler to
  never introduce them).
- **Rejected: decorative flourishes** (border ring, corner marks). Nothing else on
  the set has them; the chassis is the shared identity and -02 must be able to sit
  pips beside these faces without a style clash.

## Decision 3 — color: Taiwan two-color (blue numeral, red 萬)

- **Chosen: numeral `#2e5aa0` (the established ink-blue), 萬 `#a03c2e` (the
  established red).** This is the standard Taiwanese man-tile coloring, and the
  owner's standing direction is Taiwan-style tile art from the start (memory:
  owner-taiwan-16-tile-direction; -01 already leaned Taiwan for the honors). Both
  hexes are already in the set's palette — no new color enters the system, so the
  set keeps reading as one family.
- **Rejected: near-black numeral + red 萬 (`#2b2b2b`/`#a03c2e`)** — the Japanese
  riichi-set convention. Perfectly legible, but it's the one place we'd pick the
  Japanese look over the directed Taiwan aesthetic, and the near-black register is
  currently the *winds'* signature; keeping it exclusive to 東南西北 helps honors
  pop as a class.
- **Rejected: all-red man face (interim look).** Weak internal hierarchy (numeral
  and mark compete), and at fs 32 a solid-red 九 vs 中's red 40 gets visually
  noisy across a pond.
- **Suit-color legibility note:** blue currently signals pin on the *interim*
  faces, but that mapping was always interim; -02's coin pips will read as coins
  by *shape* (circles), not by ink alone, and man faces read as kanji columns. No
  test or teaching surface anywhere keys on suit ink hexes.

## Decision 4 — code shape: `MAN_RANKS` lookup in module context, dedicated `m` arm

- **Chosen:** add `const MAN_RANKS: Record<string, string> = { '1': '一', … '9':
  '九' }` beside `HONORS`/`SUIT_INK` in the module script (shared once across all
  chip instances, matching the established pattern), and split the numbered branch
  so `m` gets its own arm *before* the surviving p/s interim arm:
  `{:else if suit === 'm'}` → two engraved texts; `{:else if suit !== 'z' && …}` →
  the untouched interim rank+mark for p/s. The shared interim `rank` text node
  moves inside the p/s arm (man no longer renders an ASCII digit at all).
- **Why an indexed record over an array:** `kind[0]` is a string; `MAN_RANKS[kind[0]]`
  reads directly without a `Number()` cast or off-by-one index arithmetic, and
  svelte-check accepts it without narrowing gymnastics.
- **Rejected: extracting a ManFace.svelte child.** One leaf, one chassis is -01's
  Decision 4 doctrine; a 6-line branch doesn't justify a component boundary, and
  -02 would face the same false choice for pips.
- **Rejected: restructuring the whole numbered branch "for -02's benefit."**
  Touching the p/s lines widens the concurrent-edit collision surface with the
  sibling ticket for zero functional gain. Smallest possible diff on shared lines.

## Decision 5 — testing: additive describe block in tile.ssr.test.ts

- **Chosen:** extend the existing chassis-contract file (it is *the* place
  downstream tickets look) with a `man faces` block, content-only per house
  doctrine:
  1. each of 1m–9m contains its kanji numeral (`>一<` … `>九<`) *and* the 萬 mark;
  2. numeral exclusivity — each numeral appears on exactly its own kind across
     the full 34-kind sweep (nothing else engraves 一–九; catches copy-paste rank
     drift and future regressions from any suit);
  3. 萬 appears on all nine man kinds and on no other kind (pins/sous/honors stay
     萬-free — the mark is the suit's signature).
  All additive — zero edits to existing tests, so a concurrent -02 append merges
  cleanly. The existing token-exactness, wind-word, ivory-face, and sweep tests
  already re-verify the new face's structural safety for free.
- **Rejected: a separate tile.man.ssr.test.ts.** Slightly better for concurrency,
  but it fragments the chassis contract across files; the workflow doc is explicit
  that same-file collision is a DAG gap with the lock as safety net, not something
  to contort the test architecture around.
- **Not tested, deliberately:** geometry (baselines, font sizes), colors, stroke
  widths — house doctrine keeps tests content-only so the art stays redrawable.
  Visual quality goes to the human `just dev` eyeball, flagged in review.md.

## Acceptance criteria → design trace

- "All 1m–9m render original engraved-kanji SVG faces" → Decisions 2–4.
- "combined with 01-01/01-02 all 34 kinds render as art with kind tokens intact" →
  kind-token span untouched; man arm emits only kanji (no ASCII digit at all now),
  so regex-silence tightens rather than loosens.
- "SSR/drive tests and svelte-check green" → additive tests + `just test`,
  `just check`; drive tests never see Tile internals.
- "core untouched" → zero `src/core/` edits; staged paths audited at commit time.

## Out of scope, stated

Pin/sou faces (-02), size ceiling (-04), aka-dora styling, Table/App/ClaimPrompt
edits, flowers, any core change, any font shipping.
