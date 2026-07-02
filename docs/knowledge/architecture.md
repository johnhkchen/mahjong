# Mahjong — Architecture

The architectural model is **a mahjong hand as a replayable record, played entirely on one
phone**. There is no server: this is single-player, offline-first mahjong, so every decision that
Consecutive spent on multiplayer and a BEAM household-table is deleted here. What remains is a
pure rules engine behind a notation contract, and a client that folds it in the visitor's
browser. These decisions are language-agnostic — the action-log contract (below) is what keeps
them that way.

## 1. A hand/game is a record, not a session (the keystone)

A hand *is* its event list: a seed (the wall order) plus an ordered list of actions — draws,
discards, and calls (chi/pon/kan/riichi). Table state is always derived by folding the pure
engine over the actions. Nothing else is authoritative. Consequences, all free:

- **Replay** is a fold over an action-log prefix — step through any hand tile by tile.
- **Undo** is dropping the last action and re-deriving; there is no mutable board to roll back.
- **Post-hand review** — "you were tenpai here and pushed into a riichi" — is a fold plus the
  engine's own shanten/yaku analysis over the same record.
- **Deterministic tests for free.** Seed the wall, replay a logged hand, assert the outcome. A
  full game is kilobytes of text.
- **Persistence is boring.** Progress, hand history, and stats are append-only records in
  `localStorage`.

## 2. The action-log notation contract

A compact, human-readable per-hand log — seed header (wall order), then draws, discards, and
calls — modeled on Tenhou-style logs. It is the public contract of the whole system:

- The engine's interface is *log in → legal actions / next state out*.
- Property tests run over round-trips: fold a log to a state, re-serialize, and it matches.
- Replay, undo, and review are all readers of the log.
- **A bug report is a hand log.** Paste the seed + actions that misbehaved and the failing state
  reproduces exactly.
- The shell (view framework, storage, platform) is swappable around it.

## 3. The engine is a peripheral, not an organ (UCI's lesson)

The AI is a stateless function `table state → action` (draw, discard, call, or declare riichi)
behind the action-log contract — the Stockfish/UCI shape. It sees only what a player would see.
Difficulty levels, the teaching hints ("you're tenpai — declare riichi?"), safe-tile / defense
advice, post-hand review, and attract-mode self-play are all *callers of the engine*, never
features woven into the app. One correct engine, many consumers.

## 4. Client-only, offline-first

There is no server. The whole game ships as **one self-contained `index.html`** — JS, CSS, and
the inline-SVG tile art inlined into a single file — and everything runs in the browser:

- **Offline the moment it's cached.** A minimal (~20-line) service worker plus a web app manifest
  is all it takes: one file to cache, and the game boots and plays with no network. No Workbox, no
  vite-plugin-pwa precache manifest — a one-file app doesn't need a precache list.
- **Local persistence** (`localStorage`) holds hand-log history and stats — the only state there
  is. No IndexedDB.
- **iOS add-to-home** makes it a semi-PWA: the manifest gives a home-screen icon that launches
  full-screen and works in airplane mode.
- **Metro-tunnel threat model.** The design target is a person on a train with no signal. If it
  needs the network to deal the next hand, it is broken. First paint and every subsequent hand
  come from cache.

## 5. Frugality by deletion

An offline single-player game lets us delete almost everything a service carries:

- **No auth**, no accounts, no server, no sync, no online ranking, no matchmaking, no anti-cheat.
- **One coordination point that isn't even a point** — one learner, one phone, offline. Every
  distributed-systems question evaporates because there is no second party and no network.
- What's left is the game: the engine, the bots, the teaching layer, and a static shell.

## 6. Delivery topology

The artifact is **one self-contained `dist/index.html`** — and that single file is a *compile
target, not the authoring format*. The source is composable, tested modules; the build inlines
them into one file. The tortoise's edge is **rigor in the source, not app apparatus**: it ships
the *same thin artifact as the hare* — one offline, view-source-able HTML file — but compiled
from tested, composable modules instead of typed out in one shot. **Same artifact shape, opposite
provenance** is the exhibit.

Source collapses to two concerns, not five packages:

- **`src/core/`** — the pure engine + AI + action-log notation: wall build, draw/discard, calls
  (chi/pon/kan), agari detection, shanten, yaku, han/fu scoring, and the stateless bots
  (`table state → action`). Zero DOM imports, framework-agnostic TypeScript, property-tested with
  vitest (wall = exactly 136 tiles, shanten-calculator correctness, yaku + han/fu score tables).
  Big in *tests*, not runtime — and tests never ship.
- **`src/app/`** — a thin view in **Svelte 5** (components + runes `$state`/`$derived`), input
  wiring, and `localStorage` persistence (hand-log history + stats). State is a fold over the
  action log, so re-render is cheap: the table DOM is small. This layer only touches `src/app/` —
  `core/` never imports it, so the view is swappable.

The build is **Vite + `vite-plugin-singlefile`**: it inlines JS, CSS, and the original inline-SVG
tile art into one file. No code-splitting, no vendor chunks. Deploy that one file to **Cloudflare
static** at `mahjong.b28.dev`, built and shipped by CI on push to main; the b28.dev cover embeds
the *same file* in attract mode — the cover art *is* the production engine dealing and scoring a
real hand in the browser. The b28.dev embed/CSP work is zone-level and origin-agnostic, so it
survives any platform choice.

## Stack

The stack is decided: **TypeScript + Svelte 5 + Vite + `vite-plugin-singlefile` + Cloudflare
static**. A pure, tested game engine in `src/core/` with zero DOM imports, a thin Svelte 5 view in
`src/app/`, compiled by Vite into one self-contained offline `index.html`, deployed as a single
static asset.

**Svelte 5 for the view** — it's a compiler, so components disappear into ~1–3KB of vanilla JS
with no runtime VDOM: the best DX-to-weight ratio for a one-file offline app. Because it only
touches `src/app/` and `core/` is framework-agnostic behind the action-log contract, the choice is
swappable. Explicitly **not** React/Next/SSR (that was RowClear — an offline single-player game
has no server story), **not** Gleam/BEAM/Fly (that was Consecutive, a multiplayer household table
— there is no actor to host, no second player, no network), and **not** Astro (content/SSG — the
wrong shape for a stateful game).

The **Riichi-vs-other-ruleset choice is isolated behind the engine** — yaku, dora, and han/fu
scoring are `core/` internals, so redirecting to Chinese Classical or Hong Kong scoring would not
leak into the app, the view, or the contract.
