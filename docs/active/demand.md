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

## Tier 2 — The teaching layer (P2: the reason this repo exists)

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

- **Riichi-stick placement animation** — the riichi declaration moment made physical (stick
  slides to the table, tile rotated in the pond); pull once the riichi mechanic exists.
  _(advances P4)_

## Post-DoD — committed, gated behind the definition of done

- **Taiwanese 16-tile ruleset variant** — owner decision (2026-07-02): the first alternate
  ruleset is **Taiwan 16-tile** (16-tile hands / 5 sets + pair, 144-tile wall with the eight
  flowers in play, flower replacement draws, tai (台) scoring, dealer streaks). Lands behind
  the engine boundary per architecture.md — `src/core/` ruleset isolation is the enabling
  invariant, and current core work must not hardcode away from it where cheap to avoid
  (e.g. hand-size and wall-composition constants stay named, not scattered literals).
  Gated: pulled only after the Riichi definition of done is met. _(advances P1, P4)_

## Tier 5 — Rigor as the series exhibit (P5: where the one-shot can't follow)

- **Attract-mode showcase bundle** — the production engine + view folding a seeded AI-vs-AI hand
  in the visitor's browser as the b28.dev cover, no backend, pinned rebuilds. _(advances P3, P5)_
