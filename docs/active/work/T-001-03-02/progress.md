# T-001-03-02 — Progress

All plan steps complete. Three code commits + this artifacts commit. One deviation
(step 4, an upgrade), documented below.

## Step log

### Step 1 — Single-file gate ✅ (commit `bde7c65`)

- Created `scripts/verify-single-file.mjs` (five named rules: one-file, non-trivial,
  sanity-anchors, no-references, no-css-fetch; `@ts-check`; node built-ins only).
- Chained into `package.json`: `"build": "vite build && node scripts/verify-single-file.mjs"`.
- Verified: `just build` green — `verify-single-file: OK — dist/index.html is
  self-contained (37087 bytes)`.
- **Negative tests, both observed failing then restored:**
  - Planted `<img src="x.png">` in `dist/index.html` →
    `FAIL [no-references] found reference attribute: src="x.png"`, exit 1.
  - Stray `dist/stray.txt` →
    `FAIL [one-file] dist/ must hold exactly [index.html], found [index.html, stray.txt]`, exit 1.
- `just test` 26/26 green; `just check` 0 errors 0 warnings.

### Step 2 — Wrangler + deploy config ✅ (commit `d8884e5`)

- `npm install -D --save-exact wrangler` → **resolved 4.107.0** (recorded per plan).
  Lockfile diff = wrangler subtree only (+1504/−20 lines, no unrelated pin churn).
- Created `wrangler.jsonc`: assets-only (`assets.directory: "./dist"`), `name: mahjong`,
  `compatibility_date: 2026-07-02`, `$schema` kept (path exists at 4.107.0:
  `node_modules/wrangler/config-schema.json`), custom-domain deferral comment in place.
- Added scripts `deploy` / `deploy:check`.
- **AC validation evidence** — `npm run deploy:check` with `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` explicitly stripped from the environment, no wrangler login
  ever performed on this machine:

  ```
  ⛅️ wrangler 4.107.0
  ✨ Read 1 file from the assets directory /Users/johnchen/swe/repos/mahjong/dist
  Total Upload: 0.31 KiB / gzip: 0.22 KiB
  No bindings found.
  --dry-run: exiting now.        (exit 0)
  ```

  Contingency #1 from plan.md did not fire — dry-run needed no auth.
- Post-dry-run: gate re-run green (dist untouched); `.wrangler/` scratch already
  gitignored. `just test` / `just check` green.

### Step 3 — Justfile recipes ✅ (commit `8a92e6f`)

- Added `deploy` (": build"-dependent, real deploy, needs CF auth) and `deploy-check`
  (": build"-dependent dry-run) recipes; fixed `test` comment nit ("vitest over src/").
- `just --list` shows all six recipes with comments.
- `just deploy-check` run end-to-end: `_deps` → vite build → gate → dry-run, all green.
- `just deploy` deliberately **not** executed (real upload; out of scope per epic).

### Step 4 — file:// no-network smoke ✅ (evidence, no commit) — **DEVIATION (upgrade)**

Plan said: manual browser open + best-effort screenshot, no Wi-Fi toggling. Found a
strictly stronger, non-destructive method and used it instead: locally installed Chrome
141 in `--headless=new` mode with **`--proxy-server="127.0.0.1:9"`** (all http/https
routed to a dead port — network hard-blocked at the browser level; `file://` bypasses
proxying and loads from disk), fresh scratch profile, no system state touched.

- **DOM proof** (`--dump-dom` after 3s virtual time): `<div id="app">` contains the
  mounted `<main class="svelte-…">`; `>East<`, `>South<`, `>West<`, `>North<` each
  exactly once; wall count `>136<` present; `aria-label="mahjong table"` present. I.e.
  the inline module *executed* and Svelte *mounted* — beyond what the SSR test proves.
- **Visual proof** (`--screenshot`): committed as
  `docs/active/work/T-001-03-02/file-boot-evidence.png` — felt table, riichi
  orientation (EAST/you bottom, SOUTH right, WEST top, NORTH left), "136 TILES IN THE
  WALL" center. Matches `just dev`.
- Recorded sizes: dist/index.html **37,087 bytes raw / 14,582 bytes gzip**.
- Not committed as a repeatable recipe: it depends on a locally installed Chrome, which
  the pinned toolchain doesn't own. The one-glance human procedure remains: `just build`,
  Wi-Fi off, double-click `dist/index.html`.

### Step 5 — Artifacts ✅ (this commit)

research / design / structure / plan / progress / review + evidence PNG.

## Acceptance criteria → evidence map

| AC clause | Evidence |
| --- | --- |
| `just build` emits exactly one dist/index.html | gate rule `one-file`, enforced every build (negative-tested) |
| …no external script/link/img refs (all JS/CSS inlined) | gate rules `no-references` + `no-css-fetch` (negative-tested); grep of artifact: zero `src=`/`href=` |
| opening from filesystem, network disabled, renders empty table | headless Chrome, dead-proxy network, file:// → mounted DOM + screenshot (step 4) |
| `just deploy` recipe exists | justfile `deploy` recipe (`wrangler deploy`, build-gated) |
| …and validates (wrangler dry-run) without live pipeline | `just deploy-check` → dry-run exit 0 with credentials stripped (step 2 output) |

## Deviations summary

1. **Step 4 method upgrade** (manual smoke → headless Chrome with dead proxy) — rationale
   above; strictly more evidence than planned, nothing skipped.
2. None otherwise — plan followed as written; contingencies 1–3 never fired.
