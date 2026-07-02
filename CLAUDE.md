# CLAUDE.md

## Project

mahjong — **A pocket mahjong parlor that teaches you to play — offline, in your palm, real
tiles.** Faithful four-player Riichi (Japanese) mahjong against three competent AI opponents:
a real wall, calls, yaku, and han/fu scoring, played as a hanchan or tonpuusen. Teaching-first
(shanten/riichi prompts, legible yaku, safe-tile hints, post-hand review), offline-first
semi-PWA, original tile art. Entry #4 in the b28.dev tortoise-vs-hare series; this is the
tortoise's own repo, and the game sits *above the line* — too large for one response.

Read `docs/knowledge/vision.md` (scope + definition of done: "someone who only ever tapped
mahjong-solitaire finishes a real hand — and calls riichi on purpose"), `docs/knowledge/charter.md`
(value function P1–P5), and `docs/knowledge/architecture.md` (the load-bearing decisions) before
designing or implementing anything.

## Stack

- **TypeScript** everywhere — a pure, tested game engine with zero DOM/platform imports, wrapped
  in a **Vite** SPA with **vite-plugin-pwa** (Workbox) for the offline app shell and service
  worker precache. Local persistence via IndexedDB/localStorage.
- **Cloudflare static** (Workers static assets or Pages) at `mahjong.b28.dev`, CI/CD on push to
  main. No server — an offline single-player game has no server story (not Next.js/SSR, not
  BEAM/Fly).
- **Ruleset: Riichi** (Japanese) — riichi, dora, yaku, han/fu scoring — isolated behind the
  `engine` package so the ruleset choice stays redirectable.
- **Original tile art only.** Mahjong is public-domain; the name is free to use, but we never
  ship a specific commercial tile set (artwork-copyright / asset-provenance rule).
- **Packages** (see architecture.md §6): `engine` (pure rules: wall/draw/discard/calls/agari/
  shanten/yaku/scoring, no DOM), `ai` (imports engine only), `ui`/`view` (components + tile art),
  `pwa`/`client` (Vite shell + service worker + persistence), `showcase` (static self-play bundle
  for b28.dev).
- **The action log is the public contract** between all packages. The engine's interface is
  action-log in → legal actions / next state out. Property tests run over log round-trips.

## Architectural invariants (do not violate)

- A hand is its record (seed = wall order + action list of draws/discards/calls); table state is
  always derived by folding the pure engine. Nothing else is authoritative.
- The action log is the contract; replay, undo, and post-hand review are folds over it. A bug
  report is a hand log.
- The AI is a stateless peripheral (`table state → action`), never woven into app code; hints,
  difficulty, defense advice, review, and attract mode are all callers of the engine.
- Offline-first, no server: everything runs in-browser; the service worker precaches the app
  shell and engine; local persistence only.
- Randomness is seeded; full hands must be deterministically simulatable (AI-vs-AI determinism
  doubles as attract mode).
- Original tile art only — no scanned or cloned commercial tiles.
- No accounts, no server, no online play, no multiplayer/matchmaking.

## Commands

The toolchain is pinned in the project's flox environment; the justfile recipes run through it.
From the repo root:

```bash
just test     # run the test suite (engine property tests, scoring tables)
just check    # typecheck / format verification
just dev      # local Vite dev server
just build    # production static build
just deploy   # ship to Cloudflare static (mahjong.b28.dev)
```

If a `just` recipe is missing, run tools inside `flox activate -- <cmd>`.

### Directory Conventions

```
docs/active/tickets/    # Ticket files (markdown with YAML frontmatter)
docs/active/stories/    # Story files (same frontmatter pattern)
docs/active/work/       # Work artifacts, one subdirectory per ticket ID
docs/knowledge/         # Vision, charter, architecture — read before designing
```

---

The RDSPI workflow definition is in docs/knowledge/rdspi-workflow.md and is injected into agent
context by lisa automatically.
