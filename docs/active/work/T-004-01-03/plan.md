# T-004-01-03 — legalactions-claim-offers-agreement — Plan

Ordered, independently verifiable steps. Each step ends with the named checks
green; commits are atomic per step unless noted.

## Step 0 — Scratchpad scans (no repo changes)

Write a scan script in the session scratchpad (never committed) that folds
tsumogiri prefixes over candidate seeds and prints claim-window facts:

- **S0a** Re-derive the existing anchors' facts to cross-check the mirrors:
  seed 1 (chi 100 by seat 1 with 98+106; pon window on 82), seed 3 race
  (window 42: chi 47+37 by seat 0, pon 43/41 by seat 1), seed 67 window 91
  (seat 3 holds 90/88/89 → 3 pon pairs + daiminkan; also: does ANY seat have a
  chi on 91? record it either way), shouminkanPrefix67 post-draw offer, seeds
  161/280 ankan states (hand-order uses; 280 includes the drawn tile), seed
  101033 four-kan chain, seed 280 kan-maximal haitei states.
- **S0b** NEW multi-variant chi anchor: scan seeds × tsumogiri prefix lengths
  for a window where the chi seat has ≥2 run shapes and at least one shape
  with a duplicated copy (≥3 total chi offers), ideally alongside a pon by
  another seat. Freeze: seed, prefix length, window, the chi seat's full hand,
  the expected offer array in D2/D3 order (hand-derived, not read back from
  legalActions — the enumeration under test must not author its own goldens).
- **S0c** Confirm at seed-67's window which OTHER offers exist (for the frozen
  full-array order literal), and capture each anchor's expected offer arrays
  the same hand-derived way.

Verification: scanned facts for existing anchors match record.test.ts's frozen
comments exactly (any mismatch stops the ticket — it would mean a frozen
contract drifted).

## Step 1 — legal.ts enumeration + consequential edits (one commit)

The tree cannot be green with legal.ts grown but dynamics/drive unpatched
(research.md), so these land together:

1. Rewrite `legal.ts` per structure.md: `copiesInHand`, `kanAllowed`,
   `claimOffers`, `ankanOffers`, `shouminkanOffers`, four-class
   `legalActions`, module doc restating the D2 order as frozen contract.
2. `dynamics.test.ts`: draw/discard filter in `playRecord` + dangle probe,
   T-004-01-04 hand-off comment, widened `keyOf` mirror, stale-comment fix.
3. `drive.ts`: `forcedAction` last-offered-discard reverse scan + comment
   rewrite (no homogeneity claim).
4. `drive.test.ts`: adjust only if an assertion pinned last-element identity.

Verification: `just test` — every EXISTING suite green except legal.test.ts,
whose stale closed-form expectations ("exactly the single draw" at window
states) are EXPECTED to fail now; confirm the failures are only those, then
proceed immediately to step 2 within the same working session. `just check`
clean. (If preferred at commit time: steps 1+2 may squash into one commit to
keep every commit fully green — decide by whether legal.test.ts failures exist
after step 1; deviation noted in progress.md.)

## Step 2 — legal.test.ts: rewrite the closed-form suite + keyOf (commit with step 1 if needed for green)

1. Widen `keyOf` (sorted-uses normalization).
2. Rewrite suite 1 per structure.md: mustDiscard discard-only offers; pre-draw
   draw-first + claims-name-the-window; post-draw 14-discard prefix +
   kan-offers-only tail. Property-based over prefixArb plus the mirrored
   anchors.
3. Keep suites 2/3/5 textually minimal: ended-hand + offered-actions-fold
   properties already generalize; add the anchor-state runs.

Verification: `just test` fully green. Commit (or squash-commit steps 1+2).

## Step 3 — Frozen anchors + deterministic-order suite (one commit)

1. Mirror the anchor prefixes/constants from record.test.ts with derivation
   comments; add the S0b multi-variant chi anchor.
2. New "deterministic order" describe: frozen full-array literals at seed-67
   window (draw, pon×3, daiminkan, …), seed-3 race (draw, pon, chi), the
   multi-variant chi anchor, shouminkan/ankan post-draw arrays (161, 280 —
   drawn-tile-in-uses shape pinned), plus same-state-same-array double-call
   equality at each anchor.

Verification: `just test` green; the order literals fail loudly if any D2/D3
sub-order regresses.

## Step 4 — Two-sided partition: candidate spaces + suppression negatives (one commit)

1. `claimCandidatesAt` space constructor (structure.md) — documented space:
   chi/pon pairs and daiminkan triples over each seat's hand positions with
   tile = window tile; ankan 4-subsets of hand∪drawn; shouminkan × 136 tiles.
2. Exhaustive partition test at anchors: seed-1 chi window, seed-3 race
   window, seed-67 kan window, 161/280 post-draw, shouminkan-67 post-draw —
   every candidate offered ⇒ folds, outside ⇒ throws RangeError. Keep the
   existing 548-space partition running at its three old anchors unchanged.
3. Sampled-negative property gains claim bads: wrong-seat chi, decoy tile
   (tile ≠ window.tile), claim at a stale/closed window (dangled prefix),
   unheld/duplicate uses, pon of own discard.
4. Suppression anchors (offer absent AND fold throws): fifth kan at the
   101033 chain's post-draw, ankan/shouminkan on the haitei draw (seed-280
   kan-maximal), daiminkan when kans exhausted, any kan while mustDiscard
   (post-chi seed-1 state), claims after ryuukyoku.

Verification: `just test` green. Runtime check: the added folds are thousands
of short-prefix folds — if the suite exceeds ~a few seconds locally, thin the
largest candidate space (ankan 4-subsets) to the turn seat + one wrong seat
and note it in progress.md.

## Step 5 — Purity/freshness extension + full-suite verification (one commit)

1. Purity/freshness properties run at the claim/kan anchor states; add the
   fresh-`uses` identity assertion (second call's uses arrays are equal but
   not the same references).
2. Full verification: `just test`, `just check`, `just build`; skim
   `record.test.ts` count unchanged; confirm dynamics trajectories unchanged
   (its suites were green in step 1 — re-confirm).

## Step 6 — Artifacts + wrap-up

progress.md finalized (deviations ledger), review.md written (changes, AC
line-by-line, coverage, open concerns). Commit artifacts.

## Testing strategy summary

- **Unit/property**: all in legal.test.ts (the AC's named file) — structural
  closed form, two-sided partition (property-sampled + anchor-exhaustive),
  frozen order literals, purity/freshness, suppression negatives.
- **Integration**: dynamics.test.ts (unchanged trajectories prove the offered
  growth is invisible to draw/discard consumers), drive.test.ts + app SSR
  suites (app behavior identical), `just build` (ships).
- **Explicit non-goals**: claims in random trajectories (T-004-01-04), claim
  UI/bot behavior (later tickets), any record.ts change (frozen; if a fold bug
  surfaces through the new lock, STOP and surface it rather than patching
  either half to agree — that is the lock working).

## AC traceability

- "every offered claim folds via foldRecord" → steps 2 (property) + 4
  (exhaustive at anchors).
- "every non-offered claim candidate throws" → step 4 partition + negatives.
- "chi offered only against the left neighbor's fresh discard, each variant
  enumerated separately" → step 3 order literals + step 4 wrong-seat/stale
  negatives + multi-variant anchor.
- "deterministic order (same state → same array, pon/kan before chi)" → step 3
  double-call equality + frozen arrays; step 2 structural order properties.
