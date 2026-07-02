# T-001-01-01 pin-flox-toolchain — Plan

## Steps

Each step has a command sequence and a verification gate; stop and reassess on any gate
failure. Steps 1–4 produce the change; step 5 is the acceptance proof; step 6 commits.

### Step 1 — Initialize the environment

```bash
cd /Users/johnchen/swe/repos/mahjong
flox init
```

**Verify:** `.flox/env/manifest.toml`, `.flox/env.json`, `.flox/.gitignore` exist;
`git status` shows them as untracked (not ignored). If flox init auto-detects the repo and
offers to install packages interactively, decline/skip — installs happen explicitly in step 3.

### Step 2 — Widen systems

Edit `.flox/env/manifest.toml` so `[options]` declares:

```toml
[options]
systems = ["aarch64-darwin", "x86_64-darwin", "aarch64-linux", "x86_64-linux"]
```

Apply with `flox edit -f <file>` (feeding the modified manifest) so flox validates and
re-locks, rather than editing the file behind flox's back. (If `flox edit -f` is unavailable in
1.8.0, editing the TOML directly is acceptable — the next `flox install` re-locks it.)

**Verify:** manifest contains the four-system list; no error from flox.

### Step 3 — Install pinned packages

```bash
flox install nodejs@24.16.0 just@1.54.0
```

**Verify:** `[install]` in the manifest carries both entries with exact `version` fields;
`.flox/env/manifest.lock` exists and mentions all four systems (grep for `x86_64-linux`).

### Step 4 — Local activation check

```bash
flox activate -- node --version    # expect: v24.16.0
flox activate -- just --version    # expect: just 1.54.0
flox activate -- npm --version     # expect: success (any version — bundled with node 24)
git status --short                 # expect: only .flox/ additions + docs/active/work files;
                                   # no .flox/run|cache|log entries
```

### Step 5 — Fresh-clone acceptance test

The acceptance criterion says *from a fresh clone*. `.flox/run` state must not be load-bearing.
Simulate without network-pushing anything:

```bash
git clone /Users/johnchen/swe/repos/mahjong /private/tmp/…/scratchpad/mahjong-fresh
```

— but the `.flox/` files aren't committed yet at this point, so the clean-room test runs
*after* the commit in step 6, cloning the local repo (uncommitted files absent ⇒ honest test):

```bash
cd <scratchpad>/mahjong-fresh
flox activate -- node --version    # v24.16.0
flox activate -- just --version    # just 1.54.0
```

(Choosing commit-then-verify over verify-then-commit: a local clone of the committed state is
the only faithful "fresh clone" simulation. If the clean-room test fails, fix forward with a
follow-up commit — it's a docs-stage repo on a single branch; history purity is not worth a
staging dance.)

**Verify:** both commands report pinned versions from the clone. Delete the scratch clone after.

### Step 6 — Commit

One commit (flox env + the four RDSPI artifacts existing at commit time):

```bash
git add .flox docs/active/work/T-001-01-01
git commit -m "T-001-01-01: pin node 24.16.0 + just 1.54.0 in committed flox env"
```

Per ticket instructions, do **not** touch the ticket frontmatter (phase/status) — lisa owns
transitions. The pre-existing modification to `docs/active/tickets/T-001-01-01.md` in git
status (made by lisa before this session) is left unstaged.

Then run step 5's clean-room test; on success, append the result to `progress.md` (committed
with review.md at the end).

## Testing strategy

- **No unit tests**: there is no code — the deliverable is configuration. `just test` doesn't
  exist yet (T-001-01-02).
- **Verification = the acceptance commands themselves**, run twice: in-repo (step 4) and from a
  clean clone (step 5). The clean-clone run is the integration test — it proves the committed
  manifest+lock alone reconstruct the toolchain.
- **Negative check**: confirm the versions come from flox, not the host —
  `flox activate -- which node` should point into `.flox/run/...`, and host node (v26.4.0) /
  host just (1.55.0) differ from the pins, so a passing exact-version check *already proves*
  flox resolution. This is why pinning versions that differ from the host is convenient.

## Rollback

Everything is additive: `git rm -r .flox` (or reverting the commit) restores the pre-ticket
state. `.flox/run|cache|log` are disposable local artifacts.

## Deviation policy

Likely small deviations, pre-authorized with documentation in progress.md:

- flox 1.8.0 CLI flag differences (`flox edit -f` syntax, init prompts) — adapt, keep the
  target manifest content identical.
- Catalog resolution failure for a specific system (unexpected — both packages are ubiquitous
  binaries): drop to the three resolvable systems, note it in progress.md and review.md as a
  concern for the CI ticket.
- If `nodejs@24.16.0`/`just@1.54.0` exact strings mis-parse, fall back to
  `flox install nodejs@24.16.0` split into `flox edit` with explicit `version = "24.16.0"`
  fields.

## Estimated shape

One session, ~4 commands + 1 commit + 1 clean-room clone. The long pole is flox's first
resolution/download of node for four systems (network-bound, minutes at worst).
