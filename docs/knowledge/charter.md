# Mahjong — Charter

The **value function**: what is worth allocating on, anchored to `vision.md` — a pocket Riichi
parlor that teaches a solitaire-tapper to play the real game. Value = **fun-and-learning per unit
of build/maintenance effort**. Every admitted epic must advance at least one invariant:

- **P1 — Playability.** A legal, finishable hand. Wall build (136 tiles + dead wall + dora
  indicator), deal, draw and discard, legal calls (chi/pon/kan), win detection (agari), and a
  full hanchan/tonpuusen played out with three competent, non-cheating bots. Without a legal,
  finishable hand there is nothing.
- **P2 — Teachability (the crown).** Shanten/tenpai awareness surfaced ("you're tenpai — declare
  riichi?"), yaku made legible, dora explained, safe-tile / defense hints, and post-hand review.
  This is the invariant that turns a solitaire-tapper into someone who understands the game — it
  is why the repo exists, not a nice-to-have.
- **P3 — Offline-PWA shippability as CI/CD.** iOS home-screen install, fully offline, push to
  main → tests → live at `mahjong.b28.dev`. Deploy is nobody's job. The b28.dev embed (zone-level
  CSP rules) is zero-touch.
- **P4 — Feel and original art.** Mobile-first table, discard pond, riichi-stick and call
  animations, tile sorting. All tile **artwork is original** — this is where the
  no-commercial-tileset rule is asserted: we never ship a scanned or cloned proprietary set.
- **P5 — Rigor as the exhibit.** The pure engine behind the action-log contract (see
  `architecture.md`), property-tested — the wall is exactly 136 tiles, the shanten calculator is
  correct, yaku detection and han/fu → score tables hold — with seeded-RNG full-hand simulation
  and AI-vs-AI determinism doubling as attract mode. **Scoring correctness (han/fu → points) is
  the property-test crown.** This is the axis a one-shot structurally cannot reach.

## Gates

- **Valuable** — advances fun-and-learning. If it doesn't make a beginner's hand more fun or more
  legible, shelve it.
- **Allocatable** — completable within a single lisa-loop span; no multi-day yaks.
- **In-bounds** — inside the vision. Reject: accounts/auth, online multiplayer, matchmaking,
  anti-cheat, native apps, real-money/gambling, ranking ladders.
- **Well-formed** — decomposes into graph-valid stories/tickets with clean file boundaries.

## De-prioritize / reject

- Anything that grows the surface past "one learner, one phone, offline, a static deploy nobody
  touches for weeks." An offline single-player game has no server story, and we keep it that way.
- Accounts, online multiplayer, matchmaking, native apps, real-money or gambling features,
  ranking ladders — all rejected outright, not deferred.
- Alternate rulesets, tournament modes, and social features — until the definition of done (a
  solitaire-tapper finishing a real hand and calling riichi on purpose) is met.

## Tie-breaker

Pull the signal that makes a beginner's next hand more fun and more legible first.
