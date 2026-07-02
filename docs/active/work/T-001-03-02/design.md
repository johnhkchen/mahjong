# T-001-03-02 — Design: single-file offline build + deploy recipe

Four decisions, each with the options considered and why the winner wins. Grounded in
research.md; section references point there.

## Decision 1 — Cloudflare product: **Workers static assets** (not Pages)

The knowledge docs left this open ("Workers static assets or Pages", research §5). This
ticket must pick one, because a validatable deploy recipe needs a concrete config.

**Options:**

- **A. Workers static assets** — a `wrangler.jsonc` with `assets.directory` pointing at
  `dist/`, no worker script at all (assets-only Workers are first-class). Deploy is
  `wrangler deploy`; **`wrangler deploy --dry-run` exists** and validates config +
  resolves assets without auth or network account state — exactly the AC's "validates
  without requiring the live pipeline".
- **B. Cloudflare Pages** — `wrangler pages deploy dist`. No dry-run flag; the command
  wants a project name that must already exist (or be created interactively) and
  authenticates immediately. Validation without credentials is not possible. Pages is
  also in maintenance mode — Cloudflare's own guidance steers new projects to Workers
  static assets.
- **C. Direct API upload (curl)** — reinvents wrangler, no validation story, secrets
  handling by hand. Not seriously considered.

**Choice: A.** It is the only option with a real offline validation command, and it is
the platform-forward choice. The architecture doc's promise that the b28.dev embed/CSP
work "survives any platform choice" (research §5) means nothing downstream is bet on
this; if Pages ever became necessary the recipe is one line.

Config consequences: `wrangler.jsonc` at repo root with `name: "mahjong"`,
`compatibility_date`, `assets.directory: "./dist"`. **No route/custom-domain block** —
attaching `mahjong.b28.dev` is zone-level pipeline work the epic explicitly defers
(research §2); a comment in the config marks where it lands.

## Decision 2 — Wrangler acquisition: **pinned npm devDependency**

**Options:**

- **A. devDependency, exact-pinned, in package-lock** — matches every existing JS tool
  in this repo (research §4: "node-side tools are npm devDependencies, not flox
  packages"); `npm ci` via the justfile `_deps` recipe makes it appear for free on a
  fresh clone; version is locked so deploys are reproducible.
- **B. `npx wrangler@<ver>` ad hoc** — downloads at deploy time (network dependency at
  exactly the moment we're proving offline-ness), not in the lockfile, cache-dependent.
- **C. flox package** — flox pins only platform tools here (node, just); wrangler in the
  flox catalog lags npm releases, and splitting JS tooling across two pinning systems
  breaks the established convention.

**Choice: A.** Cost: wrangler is a heavy devDependency (~10⁷ bytes plus workerd), but it
is dev-only, never ships (nothing from node_modules can ship — the artifact is one
inspected HTML file), and reproducibility of `just deploy` is worth disk. Pin exact
(`--save-exact`) to match the repo's exact-version style.

## Decision 3 — The single-file gate: **post-build script chained into `npm run build`**

The AC's first clause ("`just build` emits exactly one dist/index.html with no external
script/link/img references") is currently *true by accident* and enforced by nothing
(research §3). The gate should make `just build` itself fail if the property breaks.

**Options:**

- **A. `vite build && node scripts/verify-single-file.mjs`** — the gate runs on every
  build, exactly where the AC states the property ("`just build` emits…"). Canonical
  commands live in package.json scripts (justfile header, research §4), so chaining
  there, not in the justfile, keeps the justfile a thin flox shim. `// @ts-check` on the
  script gives editor-level type safety without new tsconfig plumbing.
- **B. A vitest file over `dist/`** — couples `just test` to build state (fails or
  silently skips when `dist/` is absent), sits outside the `src/**` include glob, and
  breaks the "tests never ship / tests cover src" shape (research §7). Rejected.
- **C. Shell one-liners in the justfile recipe** — greps in just recipes are unreadable,
  untypechecked, and drift from the package.json-is-canonical rule. Rejected.

**Choice: A.** Gate assertions (fail-loud, each with a named reason):

1. `dist/` contains **exactly one file**, named `index.html` (catches a future second
   chunk, sourcemap, or stray asset).
2. Zero `src="…"`/`href="…"` attributes anywhere in the file (research §3 confirmed the
   current output has none — inline script/style only). This single rule covers external
   script/link/img in one stroke and is deliberately stricter than the AC: even a
   *relative* reference breaks `file://`-with-no-siblings, so any reference at all is a
   defect. `data:` URIs would appear inside `url(…)`/`srcset` forms — still caught if
   attribute-shaped; explicitly allowed inside CSS.
3. `http(s)://` never appears inside CSS `url(…)` (belt-and-suspenders for font/image
   pulls the attribute rule can't see).
4. Sanity anchors: doctype present, `<div id="app">` present, file non-trivially sized
   (> 10 kB) — an empty or half-written file must not pass.

## Decision 4 — No-network render proof: **static self-containment + documented manual smoke** (no new browser tooling)

**Options:**

- **A. Static gate + manual smoke** — the gate (Decision 3) proves the artifact
  references nothing; the existing SSR test already proves App renders the derived
  table (research §7); the residual risk is only "does a real browser execute the inline
  module from `file://`" — verified by a human once per meaningful build change, with
  the exact procedure written into progress.md/review.md. Attempt a screenshot as
  Implement-phase evidence if the environment cooperates.
- **B. Add Playwright/puppeteer** — a headless-browser dependency stack (hundreds of MB,
  browser binaries, CI complexity) to watch an empty table render, in an epic whose
  point is a walking skeleton. The teaching/gameplay epics may earn this later; today it
  is apparatus. Rejected *for this ticket* — noted as the honest gap in review.md.
- **C. jsdom-based mount test** — jsdom doesn't execute the built single file the way a
  browser does (module script semantics, `file://` origin), so it proves less than the
  existing SSR test already does while adding a dep. Rejected.

**Choice: A.** Rationale: the AC's browser clause is about the *artifact's*
self-containment, and every failure mode that could break it (external ref, second
file, network fetch) is caught statically by the gate; the browser-execution residue is
tiny, stable, and cheap to check by eye. This mirrors T-001-03-01's accepted
no-mount-test gap (research §6), which explicitly delegated the browser path to this
ticket's manual verification.

## Recipe surface (consequence of Decisions 1–3)

- `just build` → `npm run build` → `vite build && node scripts/verify-single-file.mjs`.
- `just deploy` → `npm run deploy` → `wrangler deploy` (real deploy; needs auth — that's
  correct and stays; it is the pipeline's future entry point). Depends on `build` so the
  gate always runs first.
- `just deploy-check` → `npm run deploy:check` → `wrangler deploy --dry-run` (the AC's
  validation evidence; no auth, no network account state). Also depends on `build`.
- justfile `test` comment nit fixed in passing (research §8, flagged by prior review).

## Invariants check

- "Single file is a compile target, not the authoring format" — strengthened (gate).
- No `src/` runtime changes; core purity untouched; no new runtime deps; nothing from
  node_modules ships. Determinism, no-server, original-art invariants unaffected.
- CLAUDE.md's advertised `just deploy` command becomes real.

## Rejected-and-recorded summary

Pages (no dry-run, maintenance mode); npx/flox wrangler (unpinned / wrong pin system);
vitest-over-dist and justfile-grep gates (build-state coupling / canon violation);
Playwright and jsdom (heavy or weaker-than-existing proof). Custom-domain routing left
to the pipeline play by explicit epic fence.
