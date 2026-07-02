# T-001-01-01 pin-flox-toolchain — Research

## Ticket

Pin node/just/toolchain in a flox environment so every later session (human or autonomous)
builds against identical versions. Acceptance: from a fresh clone, `flox activate -- node
--version` and `flox activate -- just --version` succeed and report the pinned versions; the
flox manifest is committed.

## Current repository state

The repo is docs-only. There is **no code, no toolchain, and no flox environment yet**:

- No `.flox/` directory — `flox init` has never been run here.
- No `justfile` — CLAUDE.md documents `just dev/test/check/build/deploy` recipes, but they do
  not exist yet. Creating them is explicitly the follow-up ticket T-001-01-02
  ("…driven by justfile dev/test/check/build recipes").
- No `package.json`, no `src/`, no `node_modules/`. The Vite + Svelte 5 + vitest scaffold is
  also T-001-01-02.
- Root contents: `CLAUDE.md`, `START_HERE.md`, `docs/` (knowledge + active tickets/stories/work),
  `.lisa*`/`.vend` orchestration state, `.gitignore`, `board.svg`.

### `.gitignore` already anticipates flox

```
.flox/run/
.flox/cache/
.flox/log/
```

Only the *transient* flox subdirectories are ignored. This means the repo convention is already
set: the environment definition under `.flox/env/` (manifest + lock) and `.flox/env.json` are
intended to be **committed**. No `.gitignore` change should be needed.

## Host tooling observed (what we must not depend on)

The dev machine happens to have tools installed globally, which is exactly the drift this
ticket eliminates:

- `flox 1.8.0` at `/usr/local/bin/flox` — flox itself is the one assumed prerequisite; it is
  installed and working.
- `just 1.55.0` from Homebrew (`/opt/homebrew/bin/just`).
- `node v26.4.0` from Homebrew — note this is a *current/odd-numbered-adjacent* line, not LTS,
  and newer than anything the flox catalog pins. Relying on the host node would mean autonomous
  sessions on other machines (or CI) see different versions. This is the drift the flox pin
  exists to prevent.

Platform: macOS (darwin, arm64). Later sessions may run on linux (CI, cloud agents), so the
environment must resolve for multiple systems — flox manifests carry a `systems` list for this.

## Flox catalog availability (verified live)

`flox show nodejs` and `flox show just` against the catalog on 2026-07-02:

- **nodejs**: 24.16.0, 24.15.0, … (24.x line), 22.21.1 … (22.x line), 20.x, 18.x.
  Node 24 is the current LTS line and is what Vite/Svelte 5/vitest target comfortably
  (Vite requires ^20.19 / >=22.12; Node 24 satisfies all downstream needs for T-001-01-02).
- **just**: 1.54.0, 1.51.0, 1.50.0, … (no 1.55 in catalog yet — the Homebrew 1.55.0 on this
  host cannot be matched exactly; the pin will necessarily differ from the host version, which
  is fine and expected).

Version pinning syntax in a flox manifest: `install.<name>.pkg-path = "nodejs"` plus
`version = "24.16.0"` (exact) — or `flox install nodejs@24.16.0` which writes the same. The
lockfile (`.flox/env/manifest.lock`) records the exact catalog resolution per system, which is
what makes fresh-clone activation reproduce identical builds.

## How the environment will be consumed

- **CLAUDE.md contract**: "The toolchain is pinned in the project's flox environment; the
  justfile recipes run through it. … If a `just` recipe is missing, run tools inside
  `flox activate -- <cmd>`." So the activation entrypoint is `flox activate --`, non-interactive,
  used both by humans and by lisa-spawned agent sessions.
- **T-001-01-02** (depends on this ticket) will add the justfile and the npm toolchain
  (`npm` ships inside the flox `nodejs` package, so pinning nodejs pins npm too). Its acceptance
  criteria run "all through the flox toolchain" — it needs `node` and `just` resolvable via
  `flox activate` and nothing else from this ticket.
- **Deploy** (`just deploy`, wrangler → Cloudflare) is a later concern; wrangler is an npm
  dependency, not a flox package, so it does not need pinning here.

## Constraints and assumptions

1. **Scope boundary**: this ticket delivers only the committed flox environment with pinned
   `nodejs` and `just`. No justfile, no package.json — those are T-001-01-02, which depends on
   this ticket precisely so the DAG keeps the files disjoint.
2. **flox is assumed present** on any machine running the project (it is the bootstrap tool; a
   tool that pins the toolchain cannot pin itself). CLAUDE.md already assumes it.
3. **Multi-system**: the manifest should declare at least `aarch64-darwin` (this machine) and
   `x86_64-linux`/`aarch64-linux` (CI / cloud agents) so a fresh clone resolves anywhere. Adding
   systems requires catalog resolution per system, which `flox init`'s default systems list plus
   lockfile handles.
4. **Lockfile must be committed** — the manifest alone pins a version *request*; the lock pins
   the exact store paths/derivations per system. Both live under `.flox/env/`, which the
   existing `.gitignore` deliberately leaves tracked.
5. **npm comes with nodejs**: no separate npm pin is needed or possible in the catalog;
   `nodejs@24.16.0` bundles its matching npm.
6. **Verification is cheap and direct**: the acceptance criteria are literally
   `flox activate -- node --version` / `flox activate -- just --version`; "fresh clone" can be
   simulated by activating from a clean checkout (e.g. `git worktree` or temp clone) since
   activation builds `.flox/run` from the committed manifest+lock.

## Open questions carried to Design

- Exact-pin (`nodejs@24.16.0`) vs. range-pin (`version = "^24"`); exact favors reproducibility,
  range favors drift-free-enough with less maintenance. Charter P3 (reliability of autonomous
  sessions) leans exact.
- Whether to add a `[hook.on-activate]` or `[vars]` section now (e.g. telling npm to keep
  cache inside the project). Nothing downstream requires it yet.
- Which `systems` list to declare beyond the defaults `flox init` writes.
