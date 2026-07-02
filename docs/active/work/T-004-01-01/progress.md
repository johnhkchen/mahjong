# T-004-01-01 — chi-pon-claim-fold-semantics — Progress

## Status: complete — all plan steps executed, all gates green

| Step | What | Commit | Gate |
|---|---|---|---|
| 0 | Baseline on the untouched tree | — | 102 tests green, 0 type errors |
| 1 | Claim-window state: HandAction chi/pon members, Meld, TableState `melds`/`claimable`/`mustDiscard`, draw/discard plumbing, foldRecord init, test-literal update | `553a05b` | `just test` (102) + `just check` green |
| 2 | The claim step: `isRun`, `applyClaim`, chi/pon switch cases; scratchpad anchor scan; `describe('chi/pon claims fold')` — 8 tests | `c9cde7e` | `just test` (110) + `just check` green |
| 3 | `describe('illegal claims throw…')` — 14 negative cases | `44df5b9` | `just test` (124) + `just check` + `just build` green |
| 4 | Acceptance sweep + artifacts | (artifacts commit) | AC verified line by line, see review.md |

## Anchor scan results (Step 2)

The scratchpad scan (`scan-anchors.ts`, session scratchpad, not committed) walked
tsumogiri prefixes over seeds 0–200 deriving claim opportunities from the wall/deal
contracts only. Findings frozen into record.test.ts with derivation comments:

- **Seed 1** (already frozen in the goldens): South chis East's tsumogiri'd `100` (8s)
  with `[98, 106]` (7s+9s); South pons East's tedashi'd `82` (3s) with the `[81, 83]`
  pair. West's `97`/`104` (7s+9s run shape) and `73`/`74` (1s pair) serve the
  wrong-seat-chi and non-triplet-pon negatives.
- **Seed 3, four tsumogiri turns** (live[0..3] = `[28, 128, 25, 42]`): North's discard
  `42` (2p) is simultaneously chi-able by East (`[47, 37]` — 3p+1p) and pon-able by
  South (`[43, 41]` — the 2p pair). One frozen scenario carries BOTH the JUMP anchor
  (South pons past East, whose draw never happens) and the RACE anchor (pon-over-chi
  determinism). The plan expected two scenarios; they collapsed into one — a bonus,
  not a deviation.

## Deviations from the plan

1. **Step 1's typing watchpoint never fired.** The `default` arm's cast tolerates the
   widened union, so chi/pon actions folded through "unknown action type" between
   commits 1 and 2 exactly as planned — no early case labels needed.
2. **The discard case became a four-arm if/else-if chain** (claim-discard / not-drawn
   / tsumogiri / tedashi) with `drawn = null` moved into the drawn-tile arms, instead
   of a bolted-on guard — the claim arm has no drawn tile to clear. Behavior for the
   pre-existing arms is byte-identical; all pre-existing tests pass unmodified.
3. **14 negative cases, not 13** — the claimed-tile-as-`uses` case earned its own test
   beside the other-seat's-tile case (both land in the uses-held guard).
4. **No `/verify` app drive** (as planned, but recording the rationale): claims are
   unreachable from the running app until T-004-01-03 grows `legalActions` — the app
   builds actions only from the offered set, which this ticket deliberately does not
   extend. The new fold paths' only runtime surface is the fold itself, exercised
   directly by the 22 new tests; the app-facing regression surface (unchanged
   draw/discard play) is covered by the untouched drive/SSR/legal/dynamics suites and
   `just check`/`just build`.

## Verification summary

- `just test`: 124 passed (102 baseline + 22 new), all 11 files.
- `just check`: svelte-check + tsc — 0 errors, 0 warnings (app consumers compile
  against the grown TableState untouched).
- `just build`: single-file dist/index.html builds and passes the self-containment
  check (46 kB / 17.8 kB gzip).
- `git diff` scope: exactly `src/core/record.ts`, `src/core/record.test.ts`, plus
  these docs — legal.ts, dynamics.test.ts, index.ts, and all app files untouched, as
  structure.md required.

## Handoff notes for dependent tickets

- **T-004-01-02 (kan):** `applyClaim`'s guard sequence and `Meld` are the extension
  points; `Meld.claimed`/`from` may need widening for ankan (no claimed tile) — noted
  as a seam in design.md D4. Rinshan draws will need their own arm beside the
  `claimable`-clearing in `case 'draw'`.
- **T-004-01-03 (legalActions):** the claim window is fully visible in TableState
  (`claimable`, `mustDiscard`, `melds`); enumeration needs a chi-variant walk that
  `isRun` (module-local, extractable) already implies. Until then the fold accepts
  claims legalActions does not offer — the agreement suite's "outside ⇒ throws"
  property remains true over its draw/discard candidate space.
- **T-004-01-04 (dynamics):** `allZonesWithMelds` in record.test.ts is the widened
  conservation flatten to lift into the generator suite.
