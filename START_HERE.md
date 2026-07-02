# START HERE — Mahjong (overseer brief)

You are the **overseer** of a `vend → lisa` build of **Mahjong**: real four-player **Riichi**
Mahjong versus three AI opponents, single-player and offline-first, shipped as one self-contained
HTML file. This repo is the *tortoise* in b28.dev's tortoise-vs-hare series — its whole point is
that a reviewed, tested pipeline beats a one-shot on everything except day-one speed. Your job is
not to write the game. It is to **drive the board one pull at a time, protect the invariants
below, and make the fork calls** vend puts in front of you.

The intent is already authored — read these in order before you touch anything:

1. `docs/knowledge/vision.md` — what this is and the definition of done.
2. `docs/knowledge/charter.md` — the value function (P1–P5) = what "valuable" means here.
3. `docs/knowledge/architecture.md` — the load-bearing decisions.
4. `docs/knowledge/vend-workflow.md` — how vend clears intent into work (the drive loop).
5. `docs/knowledge/rdspi-workflow.md` — the per-ticket loop lisa runs (research→design→structure→plan→implement→review).

**Definition of done:** *someone who only ever tapped mahjong-solitaire finishes a real hand —
and calls riichi on purpose.* Fun and learning per unit of effort, not feature count.

---

## The invariants you exist to protect

These are the whole reason the tortoise is worth building. Left alone, agents drift toward a
framework and a server. **Do not let a ticket land that violates these** — reject it at the gate
or `vend annotate` it back:

- **One self-contained offline `dist/index.html`.** Built with Vite + `vite-plugin-singlefile`
  (JS + CSS + inline-SVG tile art inlined). The single file is a **compile target, not the
  authoring format.** No server, no SSR, no router, no code-splitting, no multi-page output.
- **`src/core/` is pure.** Engine + AI + action-log notation, **zero DOM/framework imports**,
  property-tested with vitest (wall = exactly 136 tiles, shanten-calculator correctness, yaku +
  han/fu → score tables). It **never imports `src/app/`.** Correctness lives here; it is big in
  *tests*, not runtime.
- **`src/app/` is thin.** A Svelte 5 view (runes) + input wiring + `localStorage`. Svelte lives
  *only* here and is swappable precisely because `core/` never touches it.
- **No Workbox / `vite-plugin-pwa` precache, no IndexedDB, no React/Next, no Astro.** Offline =
  the cached single file + a ~20-line service worker + manifest for reliable iOS Add-to-Home.
- **Event-sourced.** A hand *is* `seed (wall order) + action log`; table state is always
  **derived by folding the pure engine.** Undo, replay, and post-hand review are folds over
  prefixes — never a mutable table.
- **The action log is the public contract.** The engine's interface is *log in → legal actions /
  next state out.* Tests are round-trips; a bug report is a hand log.
- **Seeded RNG.** Full hands must be deterministically simulatable — AI-vs-AI self-play doubles as
  attract mode.
- **AI plays fair.** Each seat's AI (`state → action`: draw / discard / call / riichi) is a
  stateless peripheral that reasons only from what that seat legitimately knows — no peeking at
  the wall or other hands.
- **Original tile art only.** Draw your own tiles — never ship a specific commercial tile set
  (artwork-copyright / asset-provenance rule). Inline the SVG so the artifact stays one file.
- **Ruleset stays behind the engine.** The Riichi-vs-other-ruleset choice is isolated inside
  `src/core/`; it must not leak into the view.
- **Frugality by deletion.** No accounts, no server, no online, no multiplayer, no matchmaking.

A ticket that says "add a Node backend," "switch the view to React," "precache with Workbox," or
"persist to IndexedDB" is out of bounds. Kill it.

---

## The mental model: two engines, one board

Everything lives under `docs/active/`. **vend writes the board; lisa consumes it.**

- **vend clears intent → work.** A one-line *signal* (or a pulled demand from
  `docs/active/demand.md`) becomes a typed board: an **epic** (`docs/active/epic/`), its
  **stories** (`docs/active/stories/`), and **tickets** (`docs/active/tickets/`). Work is
  admitted only if it clears the gates — **valuable · allocatable · in-bounds · well-formed** —
  and the decomposition must be graph-valid or the mint is refused.
- **lisa builds work → commits.** It picks up `phase: ready` tickets and runs each through the
  RDSPI loop, committing as it goes, up to `max_threads` concurrent Claude Code sessions.

The pull is deliberate and **one signal at a time** — vend recommends, *you* pull; it never
auto-drains the board. That's the control surface.

---

## The drive loop (your actual commands)

```bash
# 0. Health — both should be green before you start.
vend doctor
lisa validate            # "no tickets" until you pull the first signal — expected

# 1. See the board and the genuine forks vend wants you to decide.
vend steer               # ranked board + real alternatives (fund it: --budget <ms>,<tokens>)
vend svg --out board.svg # visualize the current DAG

# 2. Pull ONE signal → mint + decompose an epic (graph-valid by construction).
vend chain "<signal>" --budget <ms>,<tokens>
#   --after <ticket>   queue this epic BEHIND a running loop, race-free
#                      (its entry tickets are born blocked on <ticket>)

# 3. lisa builds the ready tickets into commits.
lisa loop                # RDSPI per ticket; commits as it goes

# 4. Sweep, then pull the next signal.
#    - verify done ⇒ committed (pre-sweep gate: "done means committed")
#    - mark cleared epics done
#    - go back to `vend steer` / `vend chain` for the next pull
```

Mid-flight steering, when a proposal is off or a fork needs your call:

```bash
vend annotate <node-id> "<feedback>" --seat designer   # redirect design intent
vend annotate <node-id> "<feedback>" --seat dev        # redirect implementation
vend shelf                                             # park a signal for later
vend audit                                             # sanity-check a play's outputs
vend envelope <play> --estimate <ms>,<tokens>          # cost a play before you fund it
```

**Your first pull:** the **walking skeleton** (the E-001 foundation in `demand.md`) — the repo
builds, `just dev` shows an empty table, one `core/` module exists with one passing test, and
`just build` emits a single `dist/index.html`. Get the skeleton committed *before* any gameplay.
Then pull **Tier 1 — a finishable hand** (wall build → draw/discard with legal calls → agari →
correct han/fu scoring, with one competent bot table). Teaching (Tier 2) is the crown, but a
legal, finishable hand comes first — without it there is nothing.

---

## Config you may tune (`.lisa.toml`)

- `max_threads` — concurrent build sessions (default 2). Raise for more parallelism once the DAG
  is wide.
- `auto_advance` — when `true`, skips the review pause between RDSPI phases. **Keep it off early**
  — the review pauses are where you catch drift against the invariants above.
- `[scheduling.phase_timeouts]` — per-phase caps if a phase runs long.

**The one DAG rule that bites:** if two tickets modify the same files, add a `depends_on` edge
between them. The commit lock is a safety net, not a substitute for correct dependency modeling.
Foundational work (the engine types, the action-log contract, the shanten/scoring modules) should
be early tickets that others depend on; independent features touching different files run in
parallel.

---

## When in doubt

Pull the signal that makes a beginner's next hand more fun or more legible. Fund small, sweep
often, and read the review output — the pipeline's value is that being wrong costs a sentence
(`vend annotate`) instead of a rewrite.
