# T-001-01-01 pin-flox-toolchain — Design

## Decision summary

Run `flox init` at the repo root and pin **`nodejs@24.16.0`** and **`just@1.54.0`** as exact
versions in `.flox/env/manifest.toml`, declaring all four mainstream systems
(`aarch64-darwin`, `x86_64-darwin`, `aarch64-linux`, `x86_64-linux`). Commit the manifest,
lockfile, and `.flox/env.json`. Nothing else — no justfile, no hooks, no vars.

## Options considered

### A. Flox environment with exact version pins — **chosen**

`install.nodejs = { pkg-path = "nodejs", version = "24.16.0" }`, same pattern for just.

- Matches the standing architecture decision: CLAUDE.md already states "the toolchain is pinned
  in the project's flox environment" — the tool choice was made at repo-seed time; this ticket
  materializes it.
- The committed `manifest.lock` resolves each pin to an exact catalog derivation per system, so
  a fresh clone on any declared system activates byte-identical toolchains. This is the
  strongest reproducibility available without vendoring binaries.
- `.gitignore` was pre-seeded for exactly this layout (ignores only `.flox/run|cache|log`).

### B. Flox with floating/range versions (`version = "^24"`) — rejected

Less maintenance when the catalog updates, but the whole point of the ticket (charter P3:
autonomous sessions must build against *identical* versions) is defeated the day the catalog
publishes 24.17.0 and a fresh `flox upgrade`/re-resolution shifts under an agent. Range pins
reintroduce the drift this ticket exists to kill. Upgrades should be deliberate, reviewed
manifest edits.

Note: even with a range, the *committed lockfile* holds resolution steady until someone runs
`flox upgrade` — but an exact pin makes intent legible in the manifest itself and makes
accidental upgrades a no-op. Exact costs nothing here.

### C. Volta / mise / nvm + Homebrew just — rejected

Would pin node fine, but splits the toolchain across two managers (node via version manager,
just via Homebrew — unpinnable, `brew upgrade` drifts). Also contradicts CLAUDE.md, which
commands (`just …`) already assume run "through the flox environment". Not seriously in play;
recorded for completeness.

### D. Devcontainer / Docker — rejected

Heavyweight for a client-only static site; poor fit for local-first mac development and for
lisa's shell-spawned agent sessions, which run plain processes, not containers. Flox gives the
same determinism as a subshell/exec wrapper with no VM.

## Version choices

- **nodejs 24.16.0** — newest 24.x in the catalog (verified live in Research). Node 24 is the
  active LTS line in mid-2026; satisfies Vite (≥22.12), Svelte 5, vitest, and
  vite-plugin-singlefile needs coming in T-001-01-02. Pinning the newest available patch of the
  LTS line maximizes runway before a deliberate bump is needed. npm ships inside this package,
  so npm is pinned transitively.
- **just 1.54.0** — newest in the catalog. The host's Homebrew 1.55.0 is not available; the
  justfile recipes coming in T-001-01-02 use bog-standard just syntax, so nothing in 1.55 is
  needed. The pinned version *supersedes* the host version inside activation (flox prepends its
  PATH), which is exactly the isolation we want.

## Systems list

Declare all four: `aarch64-darwin` (this machine), `x86_64-darwin`, `aarch64-linux`,
`x86_64-linux` (CI on GitHub-hosted runners / cloud agent boxes). Cost is a slightly larger
lockfile; benefit is that a fresh clone resolves without manifest edits wherever the tortoise
runs later. Both packages are plain binaries available on all four systems — resolution risk is
nil. (`flox init` defaults to the current system only; we widen it explicitly.)

## What is deliberately *not* in this environment

- **No justfile / recipes** — T-001-01-02's contract (it depends on this ticket; keeping the
  files disjoint is what makes the DAG edge honest).
- **No npm packages, no typescript/vite/svelte** — those are `package.json` devDependencies
  installed by npm *inside* the activated environment; pinning them is package-lock's job,
  not flox's. Flox pins the layer npm can't: node itself and non-npm CLI tools.
- **No wrangler** — deploy tooling arrives with the deploy ticket; it's an npm dep anyway.
- **No `[hook.on-activate]`, no `[vars]`** — nothing downstream needs env vars or activation
  hooks yet (Research open question resolved: add them when a consumer exists, not
  speculatively). The default manifest sections stay empty.
- **No `flox activate` auto-invocation (direnv-style)** — sessions call `flox activate -- <cmd>`
  explicitly per CLAUDE.md; wiring shell hooks is per-developer preference, not repo policy.

## Acceptance mapping

| Acceptance criterion | Design element that satisfies it |
| --- | --- |
| `flox activate -- node --version` reports pinned version from fresh clone | committed manifest+lock pin nodejs 24.16.0; activation needs only the committed files |
| `flox activate -- just --version` reports pinned version | same, just 1.54.0 |
| flox manifest is committed | `.flox/env/manifest.toml`, `.flox/env/manifest.lock`, `.flox/env.json` tracked; `.gitignore` already excludes only transient dirs |

## Risks

- **Catalog availability at activation time**: first activation on a fresh machine downloads
  from the flox catalog/store — requires network once. Accepted; identical to any package
  manager bootstrap. Subsequent activations are offline.
- **Version skew vs. host expectations**: host node is v26; inside activation it becomes
  v24.16.0. Anyone running `node` *outside* `flox activate` gets the host version — mitigated
  by CLAUDE.md's standing instruction that all commands run through flox/just, and by
  T-001-01-02 routing every recipe through the environment.
- **Lockfile merge conflicts**: single-branch, DAG-serialized work makes this negligible;
  regeneration (`flox install`) is deterministic anyway.

## Documentation touch

CLAUDE.md already documents the flox contract verbatim — no edit needed. START_HERE.md and
knowledge docs don't enumerate versions — no edit needed. The pinned versions are legible in
the manifest itself, which is the single source of truth.
