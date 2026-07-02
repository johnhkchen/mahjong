# T-001-02-01 tile-types-and-identities — Research

## Ticket in one line

Define the pure tile domain in `src/core/`: 34 tile kinds (three numbered suits + honors),
4 copies each, yielding 136 distinct tile identities — zero DOM/framework imports. This is
the foundation the engine (wall, calls, shanten, yaku, scoring) and the action-log notation
build on. Advances P1 (playability substrate) and P5 (rigor as the exhibit).

## Where the code stands today

The repo is the T-001-01-02 scaffold, unchanged since commit `d37542c`/`61b2464`:

| Path | Contents |
| --- | --- |
| `src/core/index.ts` | 3-line placeholder: `export const ENGINE_NAME = 'mahjong-core'`, with a comment saying "T-001-02-01 grows the real tile domain here". Zero imports — the purity invariant currently holds trivially. |
| `src/core/index.test.ts` | One smoke test asserting `ENGINE_NAME === 'mahjong-core'`. Its stated purpose (per T-001-01-02 review.md) was to prove vitest→core wiring *until the first real test exists* — i.e., this ticket supersedes it. |
| `src/app/` | `main.ts` (Svelte 5 `mount()`), `App.svelte` (throwaway placeholder), `vite-env.d.ts`. Nothing in app imports core yet — the first core→app data flow is deliberately deferred to T-001-03-01. |
| `vite.config.ts` | svelte + singlefile plugins; vitest block: `environment: 'node'`, `include: ['src/**/*.test.ts']`. Tests are colocated with source. |
| `tsconfig.json` | extends `@tsconfig/svelte`, `strict: true`, `moduleResolution: bundler`, plus a load-bearing `allowJs`/`checkJs` pair (svelte-check 4.7.1 quirk, documented inline — do not touch). |
| `justfile` | `dev/test/check/build` → `flox activate -- npm run <x>`, with a self-bootstrapping `_deps` (`npm ci`) guard. No `deploy` recipe yet (T-001-03-02 owns it). |
| `package.json` | Exact-pinned devDeps: svelte 5.56.4, vite 8.1.3, vitest 4.1.9, svelte-check 4.7.1, typescript 5.9.3, etc. **No runtime dependencies and no property-testing library** — fast-check (or similar) arrives with T-001-02-02, which owns "the first property test". |

Verification idiom established by prior tickets: `just test` (vitest run), `just check`
(svelte-check + tsc over `tsconfig.node.json`), `just build` (single-file output). All run
through flox.

## Constraints from the knowledge docs

From `architecture.md` and CLAUDE.md's invariant list, the parts that bind *this* ticket:

- **`src/core/` is framework-agnostic TypeScript with zero DOM/platform imports.** The AC makes
  this grep-verifiable: no `svelte`, no `document`/`window`, no imports from `src/app/`.
- **The action-log notation is the public contract** — "a compact, human-readable per-hand log
  … modeled on Tenhou-style logs." Tile kinds will appear in that log, so whatever names kinds
  here is choosing (or at least constraining) the notation's tile vocabulary. This is the one
  place where a "just types" ticket has contract gravity.
- **Ruleset isolation**: Riichi specifics live behind the engine. The 136-tile set (34 kinds ×
  4) is common to essentially all four-player mahjong variants, so the tile domain itself is
  ruleset-neutral; Riichi-specific concepts (dora, red fives, yaku) come later and must not be
  baked in prematurely here.
- **Charter P5**: property-tested rigor is the exhibit. This ticket ships plain example-based
  vitest tests (the AC asks for enumeration counts); the property-test idiom starts next ticket.

## The domain itself (established mahjong facts the design must encode)

- **34 kinds**: characters/man 1–9, circles/pin 1–9, bamboo/sou 1–9 (27 numbered kinds), plus
  7 honors — 4 winds (East, South, West, North) and 3 dragons (white/haku, green/hatsu,
  red/chun).
- **4 identical copies of each kind** → 136 physical tiles. Copies are indistinguishable in
  play *today*, but distinct identities matter for the record-keeping model: a hand is its
  record, and a wall is an ordering of 136 *tiles*, not 34 kinds. (Riichi's optional red-five
  "akadora" rule later distinguishes one copy of each 5 — a known future consumer of per-copy
  identity, out of scope now.)
- **Standard notation** (Tenhou/mpsz, the de-facto log format the architecture doc points at):
  numbered tiles are `1m`–`9m`, `1p`–`9p`, `1s`–`9s`; honors are `1z`–`7z` in the fixed order
  East, South, West, North, Haku, Hatsu, Chun. This ordering is also the conventional canonical
  sort order (man < pin < sou < honors).
- **Standard classifications** downstream code will lean on: honors (7 kinds), terminals (1s
  and 9s of each suit, 6 kinds), simples (2–8 of each suit, 21 kinds). Yaku like tanyao,
  chanta, and honitsu are defined in exactly these terms.

## Direct consumers of this ticket's output

- **T-001-02-02** (`seeded-rng-wall-build-first-property-test`, depends_on this ticket): needs
  "the 34 kinds" and "136 tiles" as concrete values to shuffle into a wall and to assert the
  4-of-each-kind property against. Whatever this ticket exports is that ticket's input.
- **T-001-03-01** (deal + render, per story S-001-03): first core→app import; tile kinds will
  need to be renderable/nameable by the view.
- Farther out: shanten/yaku/scoring want cheap numeric indexing over kinds (count arrays of
  length 34 are the standard shanten-algorithm shape); the action log wants compact readable
  tile names.

## Assumptions and open questions carried into Design

1. **No flowers/seasons.** Riichi uses exactly 136 tiles; flower tiles are other rulesets'
   concern. The 34/136 numbers in the AC confirm this.
2. **Red fives are out of scope** but should not be *foreclosed* — per-copy identity should
   leave room for "copy 0 of each 5 is the red one" as a later rule flag.
3. **The placeholder `ENGINE_NAME` const and its smoke test** have served their purpose once a
   real module with real tests exists; whether to keep, move, or delete is a Design call
   (nothing else references `ENGINE_NAME` — verified by grep over `src/` and `docs/`… it
   appears only in `index.ts`, `index.test.ts`).
4. **How much API is "the tile domain"?** The ticket names kinds + identities. Classification
   predicates (honor/terminal/simple), suit/rank accessors, and kind↔index mapping are
   arguably part of the same domain; wall building, sorting of hands, and melds are clearly
   not (T-001-02-02+). Design must draw this line explicitly.
5. **Purity verification shape**: the AC says "verifiable by grep over src/core/" — a manual /
   documented grep is sufficient; whether to automate it (test or just recipe) is a Design
   option, not a requirement.

## What done looks like (AC restated against the codebase)

- A vitest test (colocated in `src/core/`, picked up by the existing `src/**/*.test.ts` glob)
  enumerates exactly 34 kinds and 136 distinct tile ids.
- `just check` clean — svelte-check + tsc both pass with the new module.
- `grep -rE 'svelte|document|window|src/app' src/core/` (or equivalent) shows no DOM/framework
  imports in core source.
