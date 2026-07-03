# Vend — Demand (the pull board)

Thin demand **signals**, not epics — one line of "what + why it might matter." Epics are
**pulled** from here just-in-time when there's capacity; clearing (signal → epic →
stories/tickets) happens on pull, never ahead of demand. Cleared signals crystallize to
one line in `docs/archive/demand-cleared.md` and are deleted from here.

Seeded from **real demand**: a young person who only ever tapped mahjong-solitaire and wants to
finish a real hand and call riichi on purpose (the definition of done), plus the
tortoise-vs-hare series entry this project anchors (`docs/knowledge/vision.md`). The foundation
signal (architecture walking skeleton + `just dev` WIP preview) is already pulled as **E-001**
and off this board.

---

## Tier 1 — A finishable hand (P1: without this there is nothing)

- **One competent bot table** — three non-cheating opponents that see only a player's view, draw
  from the same wall, and play a real hand start to finish. _(advances P1)_

## Tier 2 — The teaching layer (P2: the reason this repo exists)

- **Shanten + tenpai / riichi prompts** — surface distance-to-tenpai and offer "you're tenpai —
  declare riichi?" at the right moment. _(advances P2)_
- **Yaku legibility** — name and explain the yaku a hand is making or could make, so a beginner
  learns what they're building. _(advances P2)_
- **Dora explained** — show the dora indicator → dora mapping and count dora/uradora into the
  hand's value inline. _(advances P2)_
- **Safe-tile / defense hints** — after an opponent's riichi, highlight genbutsu and suji so a
  learner can fold on purpose. _(advances P2)_
- **Post-hand review** — replay the finished hand with engine notes ("tenpai here, pushed into a
  riichi"), free off the record + engine peripheral. _(advances P2, P5)_

## Tier 3 — Offline single-file build + CI/CD (P3: deploy is nobody's job)

- **Single-file offline build + minimal service worker** — Vite + `vite-plugin-singlefile`
  compiles to one self-contained `index.html`; a minimal (~20-line) service worker + web app
  manifest give iOS add-to-home and full offline play. _(advances P3)_
- **Local persistence** — hand-log history and stats in `localStorage`; resume is a page load.
  _(advances P3)_
- **Cloudflare static deploy + CI/CD** — push to green main → tests → live one-file build at
  `mahjong.b28.dev`, zero-touch b28.dev embed. _(advances P3)_

## Tier 4 — Feel and original art (P4: what makes a hand feel real)

- **Mobile-first table** — hand, discard pond, and four seats laid out for one-thumb play on a
  phone. _(advances P4)_
- **Tile motion + tile sorting** — riichi-stick placement, call and draw/discard animations, and
  auto-sort of the concealed hand. _(advances P4)_
- **Original tile art pack** — a full drawn-from-scratch tile set (man/pin/sou, winds, dragons);
  never a commercial set. **Playtest demand (2026-07-02, owner):** current tiles don't read as
  mahjong tiles — the set should look like real (OG) tiles: ivory face, beveled body, proper
  suit glyphs, and honor tiles drawn as the traditional kanji wind/dragon faces. _(advances P4)_
- **Flower tiles** — owner playtest ask (2026-07-02): would like to see flower tiles.
  **Ruleset fork to decide at pull time:** Riichi has no flowers (they belong to Chinese
  Classical / Hong Kong sets); the charter defers alternate rulesets until the definition of
  done. Options when pulled: (a) decorative only — flowers appear in art/menus/hand-end
  flourish without entering play; (b) a post-DoD ruleset variant behind the engine boundary.
  _(advances P4; (b) gated by charter)_

## Tier 5 — Rigor as the series exhibit (P5: where the one-shot can't follow)

- **Scoring property tests** — the han/fu → points crown: property-tested wall-is-exactly-136,
  shanten-calculator correctness, and yaku detection + score tables over seeded hands. _(advances
  P5)_
- **Attract-mode showcase bundle** — the production engine + view folding a seeded AI-vs-AI hand
  in the visitor's browser as the b28.dev cover, no backend, pinned rebuilds. _(advances P3, P5)_
