# T-007-01-01 — svg-tile-chassis-honors-backs — Plan

## Steps

### Step 1 — Rewrite `src/app/Tile.svelte` to the chassis

Per structure.md: prop union `id: TileId | 'back'`, module-level `HONORS` /
`SUIT_INK` lookups, one root `<span class="tile">` holding an `aria-hidden` SVG
chassis (under-body rect + ivory face rect; back panel for backs) with four face
branches (back / honor kanji / haku frame / interim numbered), and the
visually-hidden `.kind` span carrying `{kind}` (faces) or `tile back` (backs).
Update the header comment: the tile-art chassis has landed; -02/-03 replace only
the interim numbered faces.

Verify: `just check` — the union prop must compile against both consumers
unchanged; svelte-check and tsc green.

### Step 2 — Prove the existing rendering contract still holds

Run `just test`. The decisive suite is `src/app/app.ssr.test.ts`: token multiset
over the dealt table, `</span>`-sliced regions (drawn tile, winning tile), pond
order, wind-words-exactly-once, meld and prompt labels. drive/core suites cannot
be affected (no file they touch changed) but run in the same sweep.

Failure triage, should it come: a doubled token means the SVG leaked a
`[1-9][mpsz]` text node (check the interim numbered branch — rank and suit must be
separate nodes); a broken drawn-tile/winning-tile region means a stray `</span>`
landed before the hidden token; a wind-word failure means an English wind word
crept into the SVG.

### Step 3 — Add `src/app/tile.ssr.test.ts` (the chassis contract)

The five describe-groups from structure.md: per-kind token exactness across all 34
kinds; chassis presence (`<svg`, `aria-hidden`, ivory face); honor faces carry
their kanji (東南西北發中 on the right chip only, 5z frame with no kanji); the back
(svg yes, token no, "tile back" text, no wind words); full-set regex-silence sweep
(34 chips + back → exactly 34 tokens). Uses `TILE_KINDS`/`tileId` from core
read-only and a local `tileTokensOf` copy.

Verify: `just test` — new file green alongside everything else.

### Step 4 — Full gate + artifact sanity

- `just check` (again, with the test file in tsc's view).
- `just build` — vite + singlefile + `verify-single-file.mjs`: one
  `dist/index.html`, no reference attributes, non-trivial size. Note the built
  size in progress.md (baseline for -04's ~300KB ceiling).
- `git diff --stat src/core/` must be empty — the byte-for-byte AC, checked
  explicitly, especially since other lisa threads have core files dirty: stage
  only `src/app/Tile.svelte`, `src/app/tile.ssr.test.ts`, and
  `docs/active/work/T-007-01-01/`.

### Step 5 — Commit

One commit (structure.md's reasoning: rewrite + contract test are one unit):
`T-007-01-01: SVG tile chassis — honor faces, back, hidden kind token`.
Stage the explicit paths only — never `git add -A` on this shared branch.

## Testing strategy summary

- **Reused as the main proof**: `app.ssr.test.ts` — it was written content-only
  precisely so this ticket could swap Tile's internals; it passing IS the AC's
  "existing SSR/drive tests stay green".
- **New unit surface**: `tile.ssr.test.ts` — pins the per-kind token contract and
  the face art so -02/-03 (which redraw the numbered branch on this chassis)
  inherit an executable definition of "don't break the chassis".
- **Static**: `just check` for the prop union and template types.
- **Build**: `just build` for single-file integrity.
- **Not covered by automation**: visual quality (bevel reads as bevel, kanji
  weight, back contrast on felt) — flag in review.md for the owner's playtest
  eye; `just dev` for anyone verifying by hand.

## Risks going in

- Svelte a11y lint on the new markup (unlikely: no interactive elements added) —
  would surface in Step 1's `just check`.
- Whitespace in SSR output between `>` and the kind text (would break `>1z<`):
  keep `{kind}` flush against its span tags in the template.
- CJK glyph metrics vary by platform font; the `y`/font-size numbers may need one
  visual nudge — cosmetic only, no contract impact.
