# Vend — Cleared demand (compacted ledger)

Signals pulled, cleared, and verified — moved off the live board (`docs/active/demand.md`)
to keep it lean. One line per epic: what it delivered. Full cards live in
`docs/active/epic/`; full proofs in `docs/active/work/<ticket>/`.

---

- **E-001 walking-skeleton** (foundation signal, pre-seeded) — delivered the full delivery
  spine: pinned flox toolchain (node 24.16.0, just 1.54.0), Vite + Svelte 5 + vitest +
  singlefile scaffold with justfile recipes, pure `src/core/` tile domain (34 kinds / 136 ids)
  + seeded RNG (mulberry32) + wall build under the project's first property tests (26 tests),
  empty-table view derived from a seeded wall, and a self-contained offline `dist/index.html`
  (37KB, zero external refs) with a validated `just deploy` recipe. 6/6 tickets done.
- **E-002 wall-deal-hand-record-spine** ("Wall + deal + dead wall", Tier 1) — delivered the
  engine spine: wall partitioned into live + 14-tile dead wall, dora indicator flipped with
  total indicator→dora mapping (wraparounds pinned), four 13-tile hands dealt E/S/W/N, and the
  public contract made code — `HandRecord` (seed + ordered action log, vocabulary `never` until
  the turn loop widens it) folded by pure `foldRecord` → `TableState`. Deal-conservation, dora,
  seed- and fold-determinism property tests (53 total green); app renders the dealt hand + dora
  via the fold. 5/5 tickets done.
- **E-003 draw-discard-turn-loop** ("Draw / discard turn loop", Tier 1) — the hand runs:
  `HandAction` widened to draw/discard with a per-action step, E→S→W→N cycle, per-seat ordered
  ponds, ryuukyoku at wall exhaustion; `legalActions` exported with an agreement suite (every
  offered action folds; all non-offered candidates throw); fast-check dynamics — conservation at
  every prefix, fold determinism, guaranteed termination, five-operator illegal-mutation matrix
  (102 tests green). View: human plays East tap-to-discard, other seats paced tsumogiri, all off
  the fold. 5/5 tickets done.
- **E-004 legal-calls-chi-pon-kan** ("Legal calls (chi/pon/kan)", Tier 1) — interruption
  semantics over the fold: chi (kamicha-only) / pon claims with meld exposure, pond marks, and
  turn jump; all three kan forms with rinshan draw, immediate kan-dora flip (documented core
  convention), and live-wall shortening; `legalActions` claim/kan offers under a two-sided
  agreement suite; six-zone conservation + kan-aware termination + illegal-claim mutation matrix
  (214 tests green). View: call/pass prompt with chi-variant choice, melds beside hands. Rinshan
  draws and kan-dora flips are derived, never logged. 6/6 tickets done.
- **E-005 agari-win-detection** ("Agari + win detection", Tier 1) — the hand became winnable:
  agari decomposition vs a brute-force oracle, waits with exhaustion convention, the closed
  yaku catalog (names only, per-yaku positive/negative), yakuman + one-yaku gate, tsumo/ron
  through the claim seam with discard furiten, win prompt + hand-end screen naming winner/tile/
  yaku. 8/8 tickets done.
- **E-006 competent-bot-table** ("One competent bot table", Tier 1 — **Tier 1 closed**) —
  SeatView fair-play projection (provably insensitive to hidden state), the shanten crown
  (standard + chiitoi/kokushi min-combinator vs brute-force reference, 0 ⟺ tenpai), pure
  deterministic policy (shanten-minimizing discards, yaku-aware calls, always takes wins),
  S/W/N wired through the drive seam, AI-vs-AI determinism/termination harness. 9/9 tickets
  done. Sweep note: T-006-02-02's session left its combinator work uncommitted — HEAD was red
  without it; recovered at sweep (done means committed).
- **E-007 taiwanese-parlor-feel** (frontend UI polish, owner playtest demand) — original
  Taiwan-style inline-SVG tile set (chassis + honors/backs, pin/sou pips, kanji man, 8
  decorative flowers with a no-flower-in-deal test), ~300KB size ceiling in the single-file
  gate (actual: 83KB), portrait one-thumb layout with 44px targets, CSS-only draw/discard/
  claim/hand-end motion honoring prefers-reduced-motion, display-sort with tap→exact-TileId
  guard. 9/9 tickets done (577 tests green at sweep).
- **E-008 score-and-continue-the-game** (owner pull + Tier 5 scoring crown) — every win priced:
  fu table (pinfu 20/30, chiitoi 25, round-up), han onto the yaku catalog + dora/kan-dora,
  full dealer/non-dealer × ron/tsumo payment tables with limits, noten-bappu; the GameRecord
  fold (25000 starts, derived per-hand seeds, renchan/rotation with seat winds tracking); the
  han×fu property grid vs published tables + zero-sum settlements; score-breakdown screen and
  next-hand/new-game controls. Card by vend, decomposition by overseer. 8/8 tickets done.
- **E-009 declare-riichi-on-purpose** (the DoD pull) — riichi declaration/lock/1000-stick pot
  with ryuukyoku carry; riichi/double-riichi/ippatsu/uradora priced; furiten completed
  (temporary + riichi variants, fold-derived); bots declare; the tenpai "declare riichi?"
  prompt with stakes, furiten badge, yakuless notice, shanten hint. One session death left
  HEAD red mid-epic — repaired via ticket repair-note; final suite reconciles pot conservation
  at hand and game level. Card by vend, decomposition by overseer. 8/8 tickets done.
- **E-010 chinese-terminology-option** (owner ask) — Traditional Chinese game terms
  (吃 碰 槓 胡 自摸 立直 流局 聽牌 振聽, seats 東南西北, score-screen terms) behind a header
  toggle, one localStorage key, romaji default, dual-terminology SSR coverage, single-file
  gate green (104KB). Fully overseer-authored. 3/3 tickets done (936 tests at sweep).
