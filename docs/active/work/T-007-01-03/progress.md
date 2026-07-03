# T-007-01-03 — man-numbered-faces — Progress

## Step 1 — Baseline verification ✅

- `just test`: 24 files / 556 tests, all green — including `src/core/` despite the
  sibling threads' in-flight shanten diffs in the working tree (their state was
  self-consistent at this moment).
- `just check`: svelte-check 177 files, 0 errors, 0 warnings; tsc clean.
- Clean starting point; any later failure is attributable to this ticket.

## Step 2 — Tile.svelte: `MAN_RANKS` + the real man arm ✅

- Added `MAN_RANKS` (rank digit → 一…九) to the module context beside
  `HONORS`/`SUIT_INK`, with the palette note (numeral blue is a deliberate
  literal, not "pin ink").
- Split the numbered branch: new `m` arm — kanji numeral (x30, baseline 42,
  fs 32, `#2e5aa0` fill + same-color 0.6 stroke) over 萬 (x30, baseline 70,
  fs 24, `SUIT_INK.m` red, same engraving) — followed by the p/s interim arm,
  its `rank` text + coin/stick mark preserved verbatim (only the now-dead
  `suit === 'm'` mark branch removed and the comment reworded so 萬 doesn't
  appear in the p/s arm's text).
- Updated the header-comment handoff sentence: interim branch is now p/s / -02
  only; man faces join the settled list.
- Verified: `just check` 0/0, `just test` 556/556 — the pre-existing contract
  (token exactness, multiset sweep) held before any new tests were added.

## Step 3 — tile.ssr.test.ts: the man-face contract ✅

- Appended `MAN_RANK_GLYPHS` fixture + `man faces` describe block, immediately
  before the final full-set sweep block: numeral-per-kind exclusivity across all
  34 kinds; 萬 on all nine man kinds and nothing else (bare-substring negative);
  no ASCII rank digit text node on any man face.
- All additive; zero edits to existing tests.
- Verified: `just test` → 24 files / **559** tests green (556 + 3).

## Step 4 — Full gate + visual spot-check ✅

- `just check`: 0 errors / 0 warnings. `just test`: 559 green.
- `just build`: single-file dist/index.html self-contained, **77,852 bytes**
  (gzip 26.80 kB) vs -01's 77,525-byte baseline — +327 bytes, recorded for
  T-007-01-04's ceiling ledger.
- SSR body print (throwaway test, deleted after): 1m/5m/9m each emit exactly the
  two engraved `<text>` nodes with the designed attributes, one hidden `>Nm<`
  token, no ASCII digit text node. Empirical note: Svelte 5 SSR **strips template
  comments** (only `<!--[-->` hydration markers appear), so the comment-wording
  caution in plan.md was defense-in-depth, not load-bearing.

## Step 5 — Commit ✅

- Staged exactly `src/app/Tile.svelte` + `src/app/tile.ssr.test.ts`; audited via
  `git diff --cached --stat` — no `src/core/` path, no ticket frontmatter, none
  of the sibling threads' files (their shanten diffs remain unstaged in the
  working tree, untouched).
- Commit `d4d49ff` "T-007-01-03: man faces — engraved kanji numerals over the
  萬 mark" (2 files, +83/−8). No lock contention; no rebase needed.

## Step 6 — Review + artifacts ✅

- review.md written; work dir committed as the artifacts commit (this file's
  final state included).

## Deviations from plan

- **None functional.** Two incidental notes: (a) the Step-4 body print needed a
  temp test *inside* `src/app/` writing to a scratch file (vitest's include glob
  is `src/**/*.test.ts` and its console output is suppressed by config) — the
  temp file was deleted before commit; (b) comment-preservation risk turned out
  moot (comments stripped), as recorded above.

## Verification summary

| Gate | Result |
| --- | --- |
| `just test` | 24 files / 559 tests green (556 baseline + 3 new) |
| `just check` | 0 errors, 0 warnings (svelte-check + tsc) |
| `just build` | self-contained, 77,852 B / gzip 26.80 kB (+327 B vs -01) |
| staged-path audit | only the two `src/app/` files; core byte-for-byte |
