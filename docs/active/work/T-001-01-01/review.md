# T-001-01-01 pin-flox-toolchain — Review

## What changed

One commit, `cd9e10d` ("T-001-01-01: pin node 24.16.0 + just 1.54.0 in committed flox env"),
entirely additive — no file modified or deleted. (`review.md` itself lands in a small
follow-up commit, since it documents the commit it would otherwise be part of.)

### Created

| File | Role |
| --- | --- |
| `.flox/env/manifest.toml` | The deliverable: `[install]` pins `nodejs.version = "24.16.0"` and `just.version = "1.54.0"` (exact, not ranges); `options.systems` declares aarch64-darwin, aarch64-linux, x86_64-darwin, x86_64-linux |
| `.flox/env/manifest.lock` | Tool-generated exact resolution of both packages for all four systems; never hand-edited |
| `.flox/env.json` | flox env metadata (name `mahjong`), generated |
| `.flox/.gitignore`, `.flox/.gitattributes` | flox-generated housekeeping (ignores transient run/cache/log; marks the lock as generated for diffs) |
| `docs/active/work/T-001-01-01/{research,design,structure,plan,progress}.md` | RDSPI artifacts |

### Not changed (deliberately)

- Repo-root `.gitignore` — it was pre-seeded for flox and needed no edit.
- CLAUDE.md / knowledge docs — the flox contract was already documented; versions live in the
  manifest as single source of truth.
- Ticket frontmatter — untouched per workflow rules (lisa owns phase/status). The pre-existing
  unstaged edit to `docs/active/tickets/T-001-01-01.md` was left unstaged, as were the
  pre-existing untracked `.lisa-layout.kdl` and `board.svg` (not this ticket's files).
- No `justfile`, no `package.json`, no `src/` — that is T-001-01-02, which this ticket unblocks.

## Key decisions (rationale in design.md)

- **Exact pins over ranges**: charter P3 — autonomous sessions must see identical versions;
  upgrades should be deliberate manifest edits, not catalog drift.
- **nodejs 24.16.0**: newest catalog patch of the active LTS line; satisfies Vite/Svelte
  5/vitest requirements arriving in T-001-01-02; bundles npm 11.13.0 (pinned transitively).
- **just 1.54.0**: newest in the flox catalog (host Homebrew has 1.55.0, which the catalog
  doesn't; nothing downstream needs 1.55 features).
- **Four systems declared** so CI/cloud-agent linux boxes resolve from the same committed lock
  without manifest edits.

## Verification performed (test coverage)

There is no code, so no unit tests; verification is the acceptance criteria executed directly,
twice:

1. **In-repo** (working tree): `flox activate -- node --version` → `v24.16.0`;
   `-- just --version` → `just 1.54.0`; `-- npm --version` → `11.13.0`;
   `-- which node just` → both from `.flox/run/aarch64-darwin.mahjong.dev/bin/`.
2. **Fresh clone** (the acceptance wording): after committing, cloned `cd9e10d` into the
   session scratchpad and re-ran both commands from the clone — `v24.16.0` and `just 1.54.0`.
   This proves the committed manifest+lock alone reconstruct the toolchain with no reliance on
   local `.flox/run` state. Scratch clone deleted afterward.
3. **Host-leak negative check is built in**: host node is v26.4.0 and host just is 1.55.0 —
   different from both pins — so the exact-version matches above could only come from flox.
4. **Hygiene**: `git status` after activation shows no `.flox/run|cache|log` leakage.

### Coverage gaps

- **Linux resolution is locked but not executed** — the lockfile contains all four systems and
  flox resolved them at install time, but no linux machine has actually run
  `flox activate` against this lock yet. First real exercise will be CI setup (S-001 scope) or
  the first cloud-agent session. Low risk (both packages are ubiquitous prebuilt binaries), but
  worth watching on the first linux run.
- **First-activation network dependency**: a truly cold machine downloads packages from the
  flox catalog once. Untestable here; inherent to any package manager bootstrap.

## Acceptance criteria status

- [x] From a fresh clone, `flox activate -- node --version` succeeds and reports the pinned
  version (v24.16.0) — verified from an actual clone of the commit.
- [x] `flox activate -- just --version` succeeds and reports the pinned version (1.54.0) — same.
- [x] The flox manifest is committed (`manifest.toml` + `manifest.lock` + `env.json` in
  `cd9e10d`).

## Open concerns for a human reviewer

1. **Version pin choices** are the only judgment calls worth a second pair of eyes: node
   **24.16.0** (LTS line) and just **1.54.0**. If John prefers tracking node 22 (older LTS,
   maximum-boring) instead of 24, it's a two-line manifest edit + re-lock — say the word before
   T-001-01-02 builds on it.
2. **`manifest.lock` is committed with flox's generated-file gitattribute** — diffs will
   collapse it by default; reviewers who want to inspect resolution changes need
   `git diff --no-textconv` or to view the file directly. Working as intended, just noting it.
3. **flox itself is the unpinned bootstrap** (host has 1.8.0). A manifest is forward-compatible
   across flox releases per their versioning policy; if we ever want to pin the flox version
   too, that's a README/CI concern, not a manifest capability. Accepted as out of scope.
4. No TODOs or known defects. T-001-01-02 (vite/svelte/vitest scaffold + justfile) is
   unblocked.
