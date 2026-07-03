# T-007-01-02 — pin-sou-numbered-faces — Progress

## Deviation noted before implementing (2026-07-03)

Between this ticket's Research artifact and the first edit, sibling thread
**T-007-01-03 landed and committed (`d4d49ff`)** its man faces in
`src/app/Tile.svelte` and `tile.ssr.test.ts` — the m branch is now settled
kanji-numeral art (一–九 over 萬, Taiwan two-color), not the interim numeral
face the earlier artifacts describe, and a `MAN_RANK_GLYPHS`/`man faces`
describe exists in the test file. Consequences:

- The scope fence holds unchanged: this ticket still replaces **only the
  interim p/s branch** (now lines 103–112 of the committed file).
- Plan step 3's "keeps the interim manzu numerals for -03" pin is obsolete —
  -03 already landed and pinned its own faces. Dropped; the man suite covers it.
- The `.rank` CSS class lost its last user with the p/s numerals gone, so the
  selector list was trimmed (svelte-check would flag the unused selector).
- `src/app/` was verified clean against HEAD before editing, so this ticket's
  staged diff contains only its own work. Base: `d4d49ff`.

## Steps

- [x] **Step 1 — pip vocabulary + layout tables** (Tile.svelte module script):
  `PIN`/`SOU`/`RED` ink constants, `Coin`/`Stick` types with `coin()`/`stick()`
  literal builders, `PIN_LAYOUTS` (9 ranks, red accents on 1/3/5/7-diag/9
  centers), `SOU_LAYOUTS` (2s–9s; `1: []` — the bird branch owns 1s; 8s as the
  two-gable mountain via per-stick `tilt`; 9s middle row red). `Rank` type
  imported.
- [x] **Step 2 — template branches**: interim p/s region replaced with three
  branches — pin `{#each}` (circle coin + ivory square hole), the 1s bird
  (perch stick + two tail feathers + ellipse body + head + red beak path +
  ivory eye — 8 flat shapes), sou `{#each}` (rounded rect + ivory joint line,
  shared rotate transform for 8s). Instance script gained `rank` via `rankOf`;
  header comment updated ("All 34 faces and the back are settled art");
  `SUIT_INK` comment updated; `.rank` dropped from the style selector.
- [x] **Step 3 — tests** (`tile.ssr.test.ts`): new `pip faces` describe —
  coin count == N on Np; rect count == 2 + N on Ns (N ≥ 2); `<ellipse` on 1s
  exactly once and nowhere else; no `<text` on any p/s chip; 34
  pairwise-distinct faces. File header refreshed. (The planned "interim manzu"
  pin dropped per the deviation note.)
- [x] **Step 4 — verify**: `just test` 24 files / 564 tests green (includes the
  untouched token-multiset sweep now exercising the pip faces, and
  app.ssr.test.ts with zero edits). `just check` 0 errors 0 warnings.
  `just build` green: dist/index.html 80,973 bytes (gzip 27.84 kB), self-
  contained — vs 77,525 B at the -01 baseline, with -03's faces in between;
  comfortably under any ceiling concern (-04 owns that).
- [x] **Step 5 — commit code**: staged exactly `src/app/Tile.svelte`,
  `src/app/tile.ssr.test.ts`; diff audited before commit.
- [x] **Step 6 — artifacts**: this file + review.md committed as the RDSPI
  artifacts commit.

## Remaining

Nothing — all steps complete. Human eyeball at `just dev` (bird proportions,
8s gable read, red-accent balance) flagged in review.md as the standing
visual-QA note; not automatable under the content-only test doctrine.
