# T-001-03-02 — Review: single-file offline build + deploy recipe

Self-assessment and handoff. All acceptance criteria met and evidenced (progress.md's
AC→evidence map); three code commits (`bde7c65`, `d8884e5`, `8a92e6f`) plus this
artifacts commit. **Zero changes under `src/`** — config-and-tooling ticket as designed.

## What changed

| File | Change | Summary |
| --- | --- | --- |
| `scripts/verify-single-file.mjs` | new (new `scripts/` dir) | Post-build gate, five named fail-loud rules: exactly one file in `dist/` named index.html; > 10 kB; doctype + `id="app"` anchors; **zero `src=`/`href=` attributes anywhere** (stricter than the AC — even relative refs break lone-file `file://` boot); no remote `url()` in CSS. `@ts-check`, node built-ins only, zero deps. |
| `package.json` | modified | `build` now chains the gate (`vite build && node scripts/…`); new `deploy` (`wrangler deploy`) and `deploy:check` (`wrangler deploy --dry-run`) scripts; wrangler **4.107.0** exact-pinned devDependency. |
| `package-lock.json` | modified | Wrangler subtree only (+1504/−20); no unrelated pin churn (verified). |
| `wrangler.jsonc` | new | Assets-only Workers static assets config (`assets.directory: "./dist"`, no worker script, no bindings). Custom-domain routing for mahjong.b28.dev deliberately absent — deferred to the CI/CD pipeline play per E-001, marked by comment. |
| `justfile` | modified | New `deploy` and `deploy-check` recipes, both `: build`-dependent so the gate always runs before wrangler touches `dist/`; fixed stale `test` comment (prior ticket's flagged nit). |
| `docs/active/work/T-001-03-02/*` | new | RDSPI artifacts + `file-boot-evidence.png` (headless-Chrome screenshot of the no-network `file://` boot). |

Deliberately untouched: everything in `src/`, `vite.config.ts`, `svelte.config.js`,
`index.html`, tsconfigs, `.gitignore` (already had `dist/` and `.wrangler/`),
`docs/knowledge/*`.

## Decision of record made here

**Cloudflare product = Workers static assets, not Pages** (design §1). The knowledge
docs had left this open ("Workers static assets or Pages"). Chosen because
`wrangler deploy --dry-run` is the only credential-free validation path and Pages is in
maintenance mode. If Lisa/vend curate knowledge docs, architecture.md's line could be
tightened to name Workers static assets — flagged, not done here (outside a task
ticket's remit).

## Test coverage

- **New permanent gate inside `just build`** (and, via recipe dependency, inside every
  future `just deploy`): the five dist rules. Negative-tested at introduction — a
  planted `<img src>` and a stray dist file each observed failing by rule name
  (progress.md step 1). Like purity.test.ts, it guards a CLAUDE.md invariant ("ships as
  one self-contained offline index.html") mechanically from now on.
- **Existing suite untouched and green throughout**: 26/26 vitest, svelte-check +
  tsc 0/0, after every step — the proof that no behavior changed.
- **Deploy validation**: `just deploy-check` end-to-end (deps → build → gate → dry-run)
  green with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` stripped and no login state.
- **No-network boot**: headless Chrome, `file://`, all http/https proxied to a dead
  port → Svelte mounted (DOM dump: `<main>` inside `#app`, four winds, 136) +
  screenshot committed. This exceeds the plan (manual-only) and closes the exact gap
  T-001-03-01's review delegated here.

Artifact size on record: **37,087 B raw / 14,582 B gzip**.

## Gaps (known, accepted)

- **The gate has no test-of-the-test.** Its negative behavior was verified by hand once
  (evidence in progress.md), not by an automated meta-suite — same right-sizing as
  purity.test.ts's approach. If the gate regresses silently, `just build` output still
  shows the OK line with byte count as a human-visible breadcrumb.
- **No repeatable automated browser check.** The headless-Chrome smoke depends on a
  locally installed Chrome the pinned toolchain doesn't own, so it is evidence, not a
  recipe. The recurring human procedure stays one glance: `just build`, Wi-Fi off,
  double-click `dist/index.html`. Browser automation as a dependency was considered and
  rejected for this epic (design §4).
- **`just deploy` itself has never run** — it needs real Cloudflare auth, which is the
  pipeline play's scope. Its body differs from the validated `deploy-check` only by the
  `--dry-run` flag; first real execution belongs to the pipeline play (P3).
- **`no-references` rule could false-positive** on a future bundle whose inline JS
  contains an attribute-shaped string literal (e.g. Svelte emitting `src="` inside
  code). Current bundle: zero matches. Fail-loud by design; the tripping ticket refines
  the rule with its own reasoning (structure §2 boundary note).

## Open concerns for a human reviewer

1. **`compatibility_date: 2026-07-02`** (today). Assets-only config, so it gates almost
   nothing now, but it will freeze runtime semantics if a worker script is ever added.
   Convention question, not a defect.
2. **Wrangler is a heavy devDependency** (~10⁷ bytes + workerd). Accepted in design §2
   for lockfile-pinned reproducibility over `npx`/flox alternatives; flagging the disk
   cost as the judgment call.
3. **Telemetry**: wrangler collects anonymous telemetry by default (its banner says so).
   Left as-is; if the project wants it off, `wrangler telemetry disable` or
   `WRANGLER_SEND_METRICS=false` in the flox `[vars]` is a one-liner for the pipeline
   play.
4. **Gate strictness is a policy choice**: *any* `src=`/`href=` attribute fails, so the
   future service-worker/manifest epic (which needs `<link rel="manifest">` and a
   registration) **will** hit the gate and must consciously loosen it. That collision is
   intended — the invariant should be renegotiated explicitly, not eroded silently — but
   it is a planned future friction worth knowing about.

## Notes downstream

- **Pipeline play (P3, later)**: entry point is `just deploy`; needs `wrangler login`/
  API token + custom-domain block in `wrangler.jsonc` (comment marks the spot) + CI
  trigger on push to main. `deploy-check` is CI's natural PR-gate.
- **PWA/offline epic**: will add manifest + SW registration → must extend the gate's
  allowlist (structure §2 says: loosen in that ticket, with reasoning) and revisit
  `one-file` (SW file may ship alongside, or be inlined — that ticket's design call).
- **b28.dev cover embed**: the artifact is proven self-contained under a dead-network
  browser, which is exactly the embed's requirement.
