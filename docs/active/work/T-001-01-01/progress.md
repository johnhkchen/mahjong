# T-001-01-01 pin-flox-toolchain — Progress

## Completed

- **Step 1 — `flox init`**: created `.flox/` at repo root (env name `mahjong`, initially
  aarch64-darwin only). Generated files: `.flox/env.json`, `.flox/.gitignore`,
  `.flox/.gitattributes`, `.flox/env/manifest.toml`. No interactive package suggestions fired.
- **Step 2 — widen systems**: uncommented/set `options.systems` in `manifest.toml` to
  `["aarch64-darwin", "aarch64-linux", "x86_64-darwin", "x86_64-linux"]` by direct TOML edit
  (plan's sanctioned fallback; the subsequent `flox install` validated and re-locked it).
- **Step 3 — install pins**: `flox install nodejs@24.16.0 just@1.54.0` succeeded; manifest now
  carries exact `version` fields for both; `manifest.lock` generated with resolutions for all
  four systems (verified by grep — each system appears in the lock).
- **Step 4 — local activation check** (all pass):
  - `flox activate -- node --version` → `v24.16.0` ✅ (host node is v26.4.0 — proves flox
    resolution, not host leakage)
  - `flox activate -- just --version` → `just 1.54.0` ✅ (host just is 1.55.0 — same proof)
  - `flox activate -- npm --version` → `11.13.0` ✅ (bundled with node 24)
  - `flox activate -- which node just` → both from
    `.flox/run/aarch64-darwin.mahjong.dev/bin/` ✅
  - `git status` → only `.flox/` and `docs/active/work/` untracked; no `run/`/`cache/`/`log/`
    leakage (flox's generated `.flox/.gitignore` + pre-seeded repo `.gitignore` both cover it).
- **Step 6 — commit**: `.flox/` + the five work artifacts committed
  (see review.md for the hash).
- **Step 5 — fresh-clone acceptance test** (run post-commit per plan): cloned the repo into the
  session scratchpad, ran both acceptance commands from the clone — `v24.16.0` and
  `just 1.54.0` reported. Scratch clone deleted. ✅

## Deviations from plan

- **Step 2 applied as a direct manifest edit** instead of `flox edit -f` — the plan explicitly
  allowed this fallback; `flox install` immediately after validated the manifest and wrote the
  four-system lock, so nothing bypassed flox's validation.
- **Note (discovered, not a deviation)**: flox init also generated `.flox/.gitattributes`
  (marks `manifest.lock` as generated for diff purposes) — committed alongside; structure.md
  hadn't listed it.
- `manifest.lock` is written with mode 600 by flox; harmless, left as-is.

## Remaining

- Nothing. All plan steps complete; review.md is the final artifact.

## Untouched (deliberately)

- Ticket frontmatter (`phase`/`status`) — lisa owns transitions; the pre-existing unstaged
  modification to `docs/active/tickets/T-001-01-01.md` was left unstaged.
- Pre-existing untracked `.lisa-layout.kdl` and `board.svg` — not this ticket's files, left
  untracked.
- No justfile, no package.json — T-001-01-02 territory.
