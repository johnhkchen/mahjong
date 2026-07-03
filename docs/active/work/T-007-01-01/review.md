# T-007-01-01 — svg-tile-chassis-honors-backs — Review

## What changed

- **Modified: `src/app/Tile.svelte`** (46 → ~120 lines) — the text-face chip is now
  an original inline-SVG chassis: full-bleed under-body rect (`#b9a97e`, the visible
  thickness/bevel), inset ivory face (`#f6f1e4`, hairline `#c9bfa6` stroke), and an
  engraved face per kind — 東/南/西/北 in ink, 發 green, 中 red (SVG `<text>`,
  serif CJK stack, fill+hairline-stroke engraving), haku (5z) as the classic
  stroked empty frame, and an interim numbered face (rank numeral in the
  established suit ink over a small suit mark: 萬 / coin circle / bamboo rect)
  until T-007-01-02/-03 redraw those on this chassis. The prop widened to
  `id: TileId | 'back'`; `id="back"` renders the chassis with an indigo
  (`#31588f`) back panel. A visually-hidden `.kind` span carries the mpsz kind
  (or "tile back") — the chip's accessible name and the SSR tests' `>1z<` token
  in one. No consumer changed: Table/App/ClaimPrompt untouched, as the component's
  own doctrine required.
- **Created: `src/app/tile.ssr.test.ts`** (8 tests) — the chassis contract that
  -02/-03 build on: exactly one kind token per face chip across all 34 kinds; one
  aria-hidden SVG + ivory face each; no English wind words from any chip (guards
  Table's four-winds-exactly-once assertion by construction); each honor kanji on
  its kind only; 5z frame glyph-free; the back emits a chassis but zero tokens;
  a 34-chips+back sweep yields exactly the 34 kinds once each.
- **Untouched: everything else.** `src/core/` byte-for-byte clean from this ticket
  (the working tree's shanten diffs belong to other lisa threads; nothing outside
  `src/app/` + this work dir was staged). No dependencies added, no config edits.

Commit: `2933dba` "T-007-01-01: SVG tile chassis — honor faces, back, hidden kind
token" (component + contract test as one unit).

## Acceptance criteria, checked

- Original inline SVG for all 7 honor kinds + a back, no framework/dependency —
  **yes**: hand-authored defs-free SVG (kanji via platform fonts — script
  characters, not commercial tile artwork; the chassis/composition is the original
  art per design.md Decision 1).
- Visually-hidden per-tile kind token keeps `>1z<`-matching tests green — **yes**:
  `app.ssr.test.ts` passes with zero edits (24 files / 556 tests green overall).
- svelte-check passes — **yes** (0 errors, 0 warnings, plus tsc).
- `src/core` byte-for-byte untouched — **yes** (staged paths audited).

## Test coverage

- **Strong**: the token/regex contract (both app-level multiset+regions and the new
  per-kind exactness), honor face identity, back tokenlessness, wind-word safety,
  single-file build integrity (`just build` green: 77,525 bytes, gzip 26.66 kB —
  the recorded baseline for -04's ~300KB ceiling).
- **Deliberately absent**: visual/geometry assertions (kanji baseline, bevel
  proportions, colors beyond the ivory/back sentinel fills) — the tests are
  content-only by house doctrine so the art stays redrawable.

## Open concerns for a human eye

1. **Visual quality is unverified by automation.** The bevel reading as bevel,
   kanji weight/centering (baseline y=54, font-size 40 from structure.md), back
   contrast on the green felt, and the taller chip (2.1em vs the old ~1.6em) inside
   pond rows all deserve a `just dev` eyeball. Table's `.pond { min-height: 1.6em }`
   now under-reserves a row's height — harmless flex growth, but if the felt grid
   jumps visibly as first discards land, that one-line Table tweak belongs to a
   sibling polish moment (Table edits were out of this ticket's scope on purpose).
2. **Platform font variance for CJK glyphs.** The serif stack (Hiragino / Noto
   Serif CJK/TC / serif) renders everywhere but not identically; if playtest finds
   a platform where 發/萬 look wrong, the design.md fallback is hand-authored
   paths for the six honor kanji only.
3. **Interim numbered faces are intentionally plain** (numeral + mark). They exist
   so mid-hand tables stay legible until -02/-03 land their pip/kanji art; they are
   not the shipped look.
4. **The back has no caller yet** — capability landed per AC; wiring (opponent
   hand rows, wall) is future tickets' work.

No TODOs left in code; no known limitations beyond the above.
