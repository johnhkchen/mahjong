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

- **TypeScript** everywhere — a pure, tested game engine with zero DOM/platform imports, compiled
  by **Vite + `vite-plugin-singlefile`** into **one self-contained offline `index.html`** (JS, CSS,
  and inline-SVG tile art inlined). The single file is a *compile target, not the authoring
  format*. Offline via a minimal (~20-line) service worker + web app manifest — no Workbox, no
  vite-plugin-pwa. Local persistence via `localStorage`.
- **Cloudflare static** (Workers static assets or Pages) at `mahjong.b28.dev`, CI/CD on push to
  main. No server — an offline single-player game has no server story (not Next.js/SSR, not
  BEAM/Fly, not Astro).
- **Ruleset: Riichi** (Japanese) — riichi, dora, yaku, han/fu scoring — isolated behind the engine
  (`src/core/`) so the ruleset choice stays redirectable.
- **Original tile art only.** Mahjong is public-domain; the name is free to use, but we never
  ship a specific commercial tile set (artwork-copyright / asset-provenance rule).
- **Two concerns, not five packages** (see architecture.md §6): `src/core/` (pure engine + AI +
  action-log notation: wall/draw/discard/calls/agari/shanten/yaku/scoring + stateless bots, zero
  DOM, framework-agnostic, property-tested — big in tests, never ships them) and `src/app/` (thin
  **Svelte 5** view with runes `$state`/`$derived`, input wiring, `localStorage` persistence). The
  b28.dev cover embeds the *same* `index.html` in attract mode.
- **The action log is the public contract** between core and app. The engine's interface is
  action-log in → legal actions / next state out. Property tests run over log round-trips.

## Architectural invariants (do not violate)

- A hand is its record (seed = wall order + action list of draws/discards/calls); table state is
  always derived by folding the pure engine. Nothing else is authoritative.
- The action log is the contract; replay, undo, and post-hand review are folds over it. A bug
  report is a hand log.
- The AI is a stateless peripheral (`table state → action`), never woven into app code; hints,
  difficulty, defense advice, review, and attract mode are all callers of the engine.
- Ships as **one self-contained offline `index.html`** — the single file is a compile target, not
  the authoring format (Vite + `vite-plugin-singlefile` inlines JS/CSS/SVG tile art).
- No framework in `core/` — it's framework-agnostic TypeScript; the view is thin **Svelte 5** in
  `src/app/`, so it's swappable because `core/` never imports it.
- Offline-first, no server: everything runs in-browser; a minimal service worker + manifest caches
  the one file; `localStorage` persistence only (no IndexedDB).
- Randomness is seeded; full hands must be deterministically simulatable (AI-vs-AI determinism
  doubles as attract mode).
- Original tile art only — no scanned or cloned commercial tiles.
- No accounts, no server, no online play, no multiplayer/matchmaking.

## Commands

The toolchain is pinned in the project's flox environment; the justfile recipes run through it.
From the repo root:

```bash
just dev      # local Vite dev server
just test     # vitest over src/core/ (property tests, scoring tables)
just check    # svelte-check + tsc
just build    # vite build → single self-contained dist/index.html
just deploy   # ship the one file to Cloudflare static (mahjong.b28.dev)
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
