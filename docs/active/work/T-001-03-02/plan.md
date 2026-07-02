# T-001-03-02 — Plan: ordered steps with verification

Four implementation steps (three commits + one evidence step), then artifacts. Each step
is independently verifiable; verification commands run through the flox toolchain
(`just …` or `flox activate -- npx/node …`). Deviations get documented in progress.md
before proceeding.

## Step 1 — Single-file gate

**Do:**
1. Create `scripts/verify-single-file.mjs` per structure.md §2 (`@ts-check`, node
   built-ins only, five named rules: one-file, non-trivial, sanity-anchors,
   no-references, no-css-fetch).
2. Edit `package.json`: `"build": "vite build && node scripts/verify-single-file.mjs"`.

**Verify:**
- `just build` → green, gate prints size line, `dist/` holds exactly `index.html`.
- **Negative tests (must see it fail, then restore):**
  - a) Plant `<img src="x.png">` into a copy of `dist/index.html` → run the script
    directly against the tampered dist → exits 1 naming `no-references`.
  - b) Add a stray file to `dist/` → exits 1 naming the one-file rule.
  - Restore by re-running `just build`.
- `just test` and `just check` still green (proves no accidental coupling).

**Commit:** `T-001-03-02: single-file gate — build fails on external refs or extra files`

## Step 2 — Wrangler + deploy config

**Do:**
1. `flox activate -- npm install -D --save-exact wrangler` (record resolved version in
   progress.md).
2. Create `wrangler.jsonc` per structure.md §1 (assets-only; `compatibility_date` =
   today; `$schema` kept only if the path exists in the installed package; deferred
   custom-domain comment).
3. Add package.json scripts: `"deploy": "wrangler deploy"`,
   `"deploy:check": "wrangler deploy --dry-run"`.

**Verify:**
- `flox activate -- npx wrangler --version` → pinned version runs offline from
  node_modules.
- `flox activate -- npm run deploy:check` → dry-run succeeds **without any
  CLOUDFLARE_API_TOKEN / wrangler login** (this is the AC's validation evidence — capture
  the output). If dry-run unexpectedly demands auth or rejects assets-only dry-runs at
  this version, that's a design-level deviation: document, then fall back to the closest
  no-auth validation (e.g. `wrangler check` equivalent or config-parse) and flag in
  review.md.
- Confirm the dry run did **not** mutate `dist/` (gate still passes; only `.wrangler/`
  scratch, already gitignored).
- `just test` / `just check` still green.

**Commit:** `T-001-03-02: wrangler (pinned) + assets-only wrangler.jsonc + deploy scripts`

## Step 3 — Justfile recipes

**Do:**
1. Add `deploy` and `deploy-check` recipes (both `: build`-dependent, flox-wrapped) per
   structure.md §5, after `build`.
2. Fix `test` recipe comment: "vitest over src/ (property tests, scoring tables, app SSR)".

**Verify:**
- `just --list` shows dev/test/check/build/deploy/deploy-check with comments.
- `just deploy-check` end-to-end: runs `_deps` → build → gate → dry-run, all green.
- `just deploy` is **not** executed (would attempt real auth/upload — out of scope;
  its recipe body is identical in shape to deploy-check, which is the tested proxy).

**Commit:** `T-001-03-02: just deploy / deploy-check recipes; test comment nit`

## Step 4 — file:// no-network smoke (evidence, no commit)

**Do:**
1. `just build` for a fresh artifact.
2. Open `dist/index.html` from the filesystem in a real browser (`open dist/index.html`).
   Best-effort screenshot as evidence (screencapture on darwin); if the harness can't
   capture, record the manual procedure + result as performed/pending-human in
   progress.md. **Do not** toggle system Wi-Fi (destructive to the user's machine); the
   no-network claim rests on the gate's zero-external-references proof + `file://` origin
   having no same-origin fetch surface, and the AC's literal network-disabled check is
   documented as the human's one-glance step if the screenshot is inconclusive.
3. Record artifact size (raw + gzip) for the review.

**Verify:** table renders — four wind labels, 136 count, felt grid — matching what
`just dev` shows.

## Step 5 — Artifacts

Write `progress.md` (kept during steps 1–4, finalized) and `review.md` (changes, test
coverage, gaps, concerns). Commit artifacts:
`T-001-03-02: add RDSPI artifacts (research/design/structure/plan/progress/review)`
(matches the artifact-commit convention of prior tickets).

## Testing strategy summary

- **New automated gate** (runs inside `just build`, therefore inside every future deploy
  via recipe dependency): the five dist rules. This is the ticket's lasting regression
  net; it is negative-tested once by hand at introduction (step 1) rather than given its
  own meta-test suite — a deliberate right-sizing, consistent with how purity.test.ts
  self-guards (anti-silent-pass check) without a test-of-the-test.
- **No new vitest tests**: nothing under `src/` changed; the 26 existing tests (incl.
  SSR render + core purity) must stay green at every step — they are the regression
  proof that this ticket's tooling touched nothing behavioral.
- **Deploy validation**: `wrangler deploy --dry-run` executed with no credentials in the
  environment, output captured into progress.md.
- **Manual smoke**: step 4; the only non-automated AC clause, per design §Decision 4.

## Risks / contingencies

1. **`--dry-run` behavior at the installed wrangler version** (assets-only project):
   expected to parse config, resolve `./dist`, and exit 0 with an "aborting due to
   --dry-run"-style line, no auth. If it prompts for login → deviation path in step 2.
2. **npm install drift**: installing wrangler must not alter other locked versions
   (`npm install -D --save-exact wrangler` only adds); verify lockfile diff touches only
   wrangler's subtree. If it churns unrelated pins, redo with `npm ci` first.
3. **Gate false-positive on legitimate inline content**: `srcset=`/`href=` appearing
   inside inline JS strings (e.g. Svelte-generated code containing the literal
   `src=`) would trip the attribute regex. Current bundle: research §3 found zero
   matches, so the rule starts true; if a future bundle trips it falsely the rule gets
   refined then, fail-loud by design.
4. **Screenshot evidence may be impossible headlessly** — acceptable; the fallback is
   the documented manual procedure, and the render itself is already SSR-tested.

## Done means

- AC clause 1: `just build` → exactly one `dist/index.html`, gate-enforced zero external
  refs, browser-opens-from-filesystem verified (step 4).
- AC clause 2: `just deploy` recipe exists; `just deploy-check` (wrangler dry-run)
  validates with no credentials — output on record.
- All prior tests green; three code commits + one artifacts commit; progress.md and
  review.md complete.
