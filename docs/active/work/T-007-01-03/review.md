# T-007-01-03 — man-numbered-faces — Review

## What changed

- **Modified: `src/app/Tile.svelte`** (+~35 lines net) — the interim man face
  (ASCII digit over a small 萬) is replaced by the real one: an engraved kanji
  rank numeral (一二三四五六七八九, `MAN_RANKS` lookup in the module context,
  x=30 / baseline 42 / font-size 32) over the 萬 suit mark (baseline 70,
  font-size 24), both SVG `<text>` in the serif CJK stack with the honors'
  fill-plus-hairline-stroke engraving (0.6 here vs the honors' 0.75 — smaller,
  denser glyphs). Colors are the Taiwan two-color convention per the owner's
  standing aesthetic direction: numeral in the palette's ink-blue `#2e5aa0`
  (written as a literal with a comment — it is *not* `SUIT_INK.p`, so -02 can
  restyle pin ink without repainting man), 萬 in the established red
  `SUIT_INK.m`. The p/s interim arm survives verbatim as its own branch (minus
  the dead man-mark case) — that is T-007-01-02's canvas; the header comment's
  handoff sentence now names only p/s as interim. Chassis, honors, haku, back,
  kind-token span, styles: all byte-identical.
- **Modified: `src/app/tile.ssr.test.ts`** (+40 lines, purely additive) — a
  `man faces` describe block (3 tests) beside the chassis contract:
  numeral-per-kind exclusivity across the full 34-kind sweep (each 一…九 appears
  as a text node on its own man kind and nowhere else); 萬 present on all nine
  man kinds and absent — bare substring — from every other kind (the suit's
  signature, which -02's pips must also respect); no ASCII rank digit text node
  on any man face. Content-only per house doctrine; zero existing tests edited.
- **Untouched:** `src/core/` byte-for-byte (staged-path audit at commit), Table /
  App / ClaimPrompt, styles, configs, dependencies. The working tree's shanten
  diffs belong to sibling lisa threads and were never staged.

Commits: `d4d49ff` "T-007-01-03: man faces — engraved kanji numerals over the
萬 mark" (component + contract tests as one unit), plus this artifacts commit.

## Acceptance criteria, checked

- **All 1m–9m render original engraved-kanji SVG faces** — yes: original
  composition on the -01 chassis; the kanji are Unicode script characters via
  platform fonts (the -01 Decision-1 doctrine, chosen explicitly with this
  ticket in mind), not commercial tile artwork — provenance invariant holds.
- **Combined with 01-01/01-02, all 34 kinds render as art with kind tokens
  intact** — this ticket's 9 kinds join the 8 honor faces as final art (p/s
  remain interim until -02 lands; that ticket had not started as of this
  session). The hidden kind token is untouched and the 34+back sweep test still
  proves exactly one token per kind; the man SVG now contains no ASCII digit at
  all, so its regex-silence is stronger than the interim face's.
- **SSR/drive tests and svelte-check green** — yes: 24 files / 559 tests
  (556 baseline + 3 new), svelte-check + tsc 0/0, `just build` self-contained.
- **Core untouched** — yes, audited.

## Test coverage

- **Strong:** the man-face identity contract (numeral exclusivity, 萬
  suit-signature positive *and* negative, digit-free faces) plus the inherited
  chassis contract re-verifying the new arm for free (token exactness per kind,
  one aria-hidden SVG + ivory face, wind-word silence, full-set sweep).
  App-level multiset/region tests and drive tests passed unchanged.
- **Deliberately absent (house doctrine):** geometry, colors, stroke widths,
  font stacks — content-only tests keep the art redrawable. Also unasserted:
  the engraving *treatment* (fill==stroke) — cosmetic, eyeball territory.

## Open concerns for a human eye

1. **Visual quality is unverified by automation** (same class of concern as
   -01): numeral/萬 size balance (32/24), the two baselines (42/70), whether the
   0.6 stroke reads as engraving or as bold-smear at 1.5em×2.1em chip size, and
   一/二/三's wide-flat forms sitting well in the upper register. One `just dev`
   glance at a hand of man tiles settles all of it; the numbers were chosen for
   the 54×74 face but taste is the owner's.
2. **The blue-numeral / red-萬 Taiwan choice** is a design call worth an owner
   nod: it matches the directed Taiwan aesthetic and reuses the existing palette,
   but until -02 lands, interim pin faces also render blue — briefly, blue means
   both "man numeral" and "interim pin." Self-resolving when -02 ships coin pips.
3. **Platform CJK font variance** — inherited from -01 unchanged. 一–九/萬 are
   maximally common glyphs, lower risk than 發; the recorded fallback (hand-
   authored paths) stands if playtest finds a bad platform.
4. **Concurrency with T-007-01-02** — it edits the same two files (the p/s arm
   and appended test blocks). This ticket kept the shared surface minimal (p/s
   lines preserved verbatim; tests purely additive; committed promptly at
   `d4d49ff`). If -02 branched from a pre-`d4d49ff` tree, its merge must keep
   both arms — mechanically trivial, but worth a glance at whichever commit
   lands second. The 萬-negative test now also constrains -02's pip faces
   (correctly — 萬 is the man suit's signature).
5. **No aka-dora (red 5) styling** — core doesn't model it; 5m is styled like
   its neighbors on purpose. If akadora ever enters the engine, the face gets a
   variant then.

No TODOs left in code; build size ledger for -04: 77,852 B (gzip 26.80 kB),
+327 B over -01's baseline.
