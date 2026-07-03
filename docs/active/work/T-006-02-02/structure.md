# T-006-02-02 — chiitoi-kokushi-min-combinator — Structure

File-level changes and the shape of the code. Not code — the blueprint.

## 1. Files touched

| File                       | Change   | Why                                             |
| --------------------------- | -------- | ------------------------------------------------ |
| `src/core/shanten.ts`      | modified | add `shanten` + two private helpers             |
| `src/core/shanten.test.ts` | modified | add a `describe('shanten combinator', ...)` group |

No other file changes. `src/core/index.ts` already barrels `export * from
'./shanten'` (T-006-02-01) — the new `shanten` export needs no barrel edit.
`agari.ts`, `waits.ts`, `record.ts`, `tiles.ts` are read-only references, not
modified (design §2.C rejected exporting `KOKUSHI_KIND_INDEXES`).

## 2. `src/core/shanten.ts` — internal organization

Current file order (T-006-02-01, 143 lines): header comment → `countsOf` →
`MAX_MELDS` → `bestValue` → tile-count constants → `standardShanten`. New
material is appended after `standardShanten`, preserving that order (nothing
above it changes):

```
1.  Module header comment           [MODIFY: reserved-name note becomes stale,
                                      replace with the fulfilled combinator note]
2.  countsOf()                      [unchanged]
3.  MAX_MELDS                       [unchanged]
4.  bestValue()                     [unchanged]
5.  TENPAI_TILE_COUNT/AGARI_TILE_COUNT  [unchanged]
6.  standardShanten()               [unchanged]
7.  KOKUSHI_KIND_INDEXES            [NEW: private const, mirrors agari.ts]
8.  chiitoiShanten(counts)          [NEW: private function]
9.  kokushiShanten(counts)          [NEW: private function]
10. shanten(concealed, melds)       [NEW: public function — module's new face]
```

Placing the two private helpers directly above the public `shanten` combinator
mirrors the existing `bestValue`-above-`standardShanten` pattern — implementation
detail immediately followed by the face that composes it.

### 2.1 Header comment edit

Lines 1-21 currently narrate the standard form alone and end with: "the
min-of-three combinator (T-006-02-02) will fold chiitoitsu and kokushi over
it — the plain `shanten` name is reserved for that combinator." This becomes
stale once `shanten` exists. Replace the forward-looking clause with a
backward-referencing one describing what `shanten` now does (module-level
comment stays accurate to current state, the house convention every existing
module header follows — e.g. `agari.ts`'s header describes what IS, not what
WILL). The KIND-level/arity-only framing in the rest of the header is unaffected
and stays.

### 2.2 `KOKUSHI_KIND_INDEXES` placement

New private `const KOKUSHI_KIND_INDEXES: readonly number[] = [0, 8, 9, 17, 18,
26, 27, 28, 29, 30, 31, 32, 33]` with a one-line doc comment matching `agari.ts`
line 144 verbatim in meaning ("terminals of each numbered suit, TILE_KINDS
order, then all seven honors"), placed immediately before `chiitoiShanten`/
`kokushiShanten` since only `kokushiShanten` consumes it.

### 2.3 `chiitoiShanten` signature

```ts
function chiitoiShanten(counts: readonly number[]): number
```

Takes the 34-slot counts array (not raw tiles) — design §4.3. `readonly` since
it only reads.

### 2.4 `kokushiShanten` signature

```ts
function kokushiShanten(counts: readonly number[]): number
```

Same input shape as `chiitoiShanten` — both private helpers take the shared
counts array the combinator builds once.

### 2.5 `shanten` signature and placement

```ts
export function shanten(concealed: readonly TileKind[], melds: readonly Meld[]): number
```

Last function in the file — the module's public face, following
`standardShanten` immediately. Doc comment states: what it returns (the
min-of-three datum, per AC), delegation to `standardShanten` for validation
(design §4.2), the zero-meld gate for the two special forms (design §4.6), and
purity/determinism (matching the `standardShanten` doc comment's closing
clause).

## 3. No new types, no new imports

`shanten.ts` already imports `KIND_COUNT`, `kindIndexOf`, `TileKind` from
`./tiles` and `Meld` from `./record` — sufficient for the new code (no new
symbols needed from either module). No new exported types: `shanten` returns a
plain `number`, same as `standardShanten`.

## 4. `src/core/shanten.test.ts` — new test group

Appended as a new top-level `describe('shanten combinator', ...)` block, after
the existing `describe('contract', ...)` block (the file's current last
section) — new material appended, not interleaved, matching how
T-006-02-01 itself was a from-scratch file with sections in AC-then-edge-case
order.

Sub-groups (mirroring design §5's testing shape, each its own nested `it` or
small `describe`):

```
describe('shanten combinator', () => {
  describe('chiitoitsu binds the minimum', () => { ... })
  describe('kokushi binds the minimum', () => { ... })
  describe('standard form wins when neither special form is close', () => { ... })
  describe('meld gate: special forms never apply with melds present', () => { ... })
  describe('contract', () => {
    it('arity/meld-count errors pass through from standardShanten verbatim')
    it('is a pure read: inputs unmutated, repeat calls identical')
  })
})
```

Reuses the existing `h(spec)` mpsz-shorthand helper and `FAKE_MELDS`/`melds(n)`
helpers already defined at the top of the test file — no new test utilities
needed.

## 5. Ordering of changes

1. `shanten.ts`: add `KOKUSHI_KIND_INDEXES`, `chiitoiShanten`, `kokushiShanten`,
   `shanten`, in that order, then fix the header comment last (once the code it
   describes is final, so the comment accurately reflects the shipped shape).
2. `shanten.test.ts`: add the new `describe('shanten combinator', ...)` block.
3. Run `just test` and `just check`; both must be green before considering the
   ticket done (T-006-02-01's precedent: 19/19 files, 0 tsc/svelte-check
   errors).

No ordering dependency between steps 1 and 2 beyond "code exists before its
tests reference it" — small enough to write together in the Implement phase's
single step, unlike T-006-02-01 which split research/impl across separate
commits for a much larger algorithm.

## 6. What does NOT change

- `standardShanten`'s signature, body, and tests — untouched, per AC ("tests
  show ... each score lower via their own form than via standard decomposition"
  implies standard stays a distinct, independently-checkable term).
- `agari.ts`, `waits.ts` — read-only references; no export surface widened
  (design §2.C).
- `src/core/index.ts` — barrel already covers the module.
- No app-side (`src/app/`) changes — this ticket is engine-only, no UI consumes
  shanten yet (T-006-03-01, the discard policy, is the first consumer, and is a
  separate ticket).
