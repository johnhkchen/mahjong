# T-007-01-03 — man-numbered-faces — Plan

## Steps

### Step 1 — Baseline verification

Run `just test` and `just check` before touching anything, to separate this
ticket's effects from the unrelated in-flight working-tree diffs (other lisa
threads have shanten edits pending). Record the pass/fail baseline in
progress.md. If the baseline is red in `src/app/`, stop and investigate; red in
`src/core/` from sibling threads is noted and tolerated (this ticket never stages
core).

**Verify:** baseline recorded; `src/app` tests green.

### Step 2 — Tile.svelte: `MAN_RANKS` + the real man arm

Per structure.md, in one edit pass:

1. Module context: add `MAN_RANKS` (rank digit → 一…九) after `SUIT_INK`.
2. Template: split the numbered branch — new `m` arm (kanji numeral fs 32 /
   baseline 42, 萬 fs 24 / baseline 70, both engraved fill+stroke 0.6, numeral
   `#2e5aa0`, mark `SUIT_INK.m`), then the p/s interim arm carrying the existing
   `rank` text + coin/stick mark verbatim. Ensure no branch comment leaks 萬 into
   p/s output (Svelte may preserve template comments in SSR — check and, if so,
   keep 萬 out of the p/s arm's comment text; the structure.md wording already
   does).
3. Update the one stale header-comment phrase (interim branch now = p/s, -02).

**Verify:** `just check` green (svelte-check + tsc, no narrowing complaints on
`MAN_RANKS[kind[0]]`); existing `just test` still green — in particular
tile.ssr.test.ts token exactness and app.ssr.test.ts multiset tests, which
must pass *before* the new tests land (the contract is independent of them).

### Step 3 — tile.ssr.test.ts: the man-face contract

Append per structure.md: `MAN_RANK_GLYPHS` fixture + `man faces` describe block —
numeral-per-kind exclusivity sweep, 萬 on all nine man kinds and nothing else,
no ASCII rank digit in any man face's text nodes. Additive only; zero edits to
existing blocks.

**Verify:** `just test` — new tests pass; count rises by 3; everything else
unchanged. Negative check: temporarily reading the assertions, confirm they would
catch (a) a swapped numeral (2m↔3m), (b) 萬 leaking onto a pin face, (c) a
leftover ASCII digit on a man face. (Reasoned, not mutation-tested — these are
single-token containment asserts.)

### Step 4 — Full gate + visual spot-check

- `just test` (full suite), `just check`, `just build` — all green; note the
  built size against -01's 77,525-byte baseline (expect a sub-kilobyte rise;
  the ~300KB ceiling is -04's, but record the number for it).
- Render sanity: SSR-print a 1m/5m/9m chip body (a throwaway node/vitest eval is
  fine) to eyeball the emitted SVG shape — two text nodes, expected glyphs,
  engraved attributes. True pixel judgment is deferred to human `just dev`
  (flagged in review.md), consistent with -01.

**Verify:** all three commands green; build size recorded.

### Step 5 — Commit (code)

Stage exactly `src/app/Tile.svelte` + `src/app/tile.ssr.test.ts`. Audit staged
paths (`git diff --cached --stat`) — nothing from `src/core/`, no ticket
frontmatter, none of the sibling threads' files. Commit message in house style:

```
T-007-01-03: man faces — engraved kanji numerals over the 萬 mark
```

(One commit, component + contract tests together — the -01 precedent. If the
lock/branch has moved under us, pull --rebase before committing per lisa's
serialization; re-run `just test` after any rebase that touched src/app.)

**Verify:** commit lands; `git show --stat` lists exactly the two files.

### Step 6 — progress.md + review.md, artifacts commit

Write progress.md (steps completed, deviations, verification outcomes) and
review.md (changes, coverage, open concerns). Commit the work dir:

```
T-007-01-03: RDSPI artifacts — research through review
```

**Verify:** work dir committed; ticket frontmatter untouched by us.

## Testing strategy

- **Unit (SSR) — the new coverage:** man-face contract in tile.ssr.test.ts as
  above; content-only per house doctrine (no geometry/color assertions).
- **Regression — already existing, must stay green untouched:** token multiset
  exactness per kind and across the 34+back sweep; one aria-hidden SVG + ivory
  face; wind-word silence; honor-kanji exclusivity; haku glyph-freedom; back
  tokenlessness (tile.ssr.test.ts); app-level token multiset/regions
  (app.ssr.test.ts); drive.test.ts end-to-end seam.
- **Static:** svelte-check + tsc via `just check`.
- **Build integrity:** `just build` single-file output; size noted for -04.
- **Deliberately untested:** visual geometry/color (house doctrine: art stays
  redrawable; human eyeball at `just dev` is the check).

## Risks and contingencies

- **Concurrent T-007-01-02 edits to the same two files.** Mitigation: smallest
  diff (p/s lines move verbatim, tests append at file end), commit promptly,
  rebase-and-rerun if the lock forces a merge. If an actual textual conflict
  appears mid-flight, resolve preserving both tickets' arms/blocks — they are
  disjoint by construction.
- **Svelte preserving template comments in SSR output** could make comment text
  visible to bare-substring assertions. Handled by wording (no 萬 in the p/s
  comment) and verified empirically in Step 4's body print.
- **Platform font oddity for a numeral** (e.g., 四 weight) — not detectable in
  SSR; goes to review.md's human-eyeball list, same as -01's honor kanji.
- **Unrelated red tests from sibling threads' shanten work** — tolerated if
  confined to `src/core/`; recorded in progress.md so the reviewer can attribute
  failures correctly.

## Step → acceptance-criteria map

- AC "1m–9m original engraved-kanji faces": Steps 2, 4.
- AC "34 kinds render with kind tokens intact": Step 2's untouched token span +
  Step 3's regression suite + existing sweep test.
- AC "SSR/drive tests and svelte-check green": Steps 3–4 gates.
- AC "core untouched": Step 5 staged-path audit.
