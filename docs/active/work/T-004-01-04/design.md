# T-004-01-04 — call-dynamics-property-suite — Design

Test-only ticket: grow `dynamics.test.ts` so random-legal trajectories sample the full
call vocabulary, and re-state its four invariant families over the widened space. Six
decisions, each grounded in research.md.

## D1 — Generator: one driver over the FULL offered set, one choice per action

Rewrite `playRecord` to drop the `drawsAndDiscards` filter and consume **one choice
per action point**, always indexing `legal[choice % legal.length]`. The walk stops
when choices run out or the offered set empties; the hard bound stays as the
termination tripwire.

- *Rejected: keep "choices only at multi-action points".* With claims, pre-draw
  points become multi-action unpredictably, so "choice count = complete turns" is
  already dead; a choice-per-action is the only convention whose game length is
  legible from the choices array (and it makes `fullGameArb` trivially total — see
  D3).
- *Rejected: weighted policies inside one arb (fc.oneof over greedy/uniform).* Opaque
  shrinking; call density is handled by D2's deterministic corpus instead.
- Uniform modulo is naturally call-dense where it matters: a claim window offering
  1 draw + k claims picks a claim k/(k+1) of the time.

**Choice domain widens from `fc.nat(13)` to `fc.nat(19)`.** nat(13) was matched to the
14-discard offering; post-draw offerings now run to 14 + kan offers (≈18 worst case)
and `choice % L` with choice ≤ 13 would make index 14+ — precisely the kan offers —
unreachable. 20 values keep shrinking mapped onto low hand indexes while covering the
longest real offerings; the modulo stays for safety, not correctness of coverage.

**The bound becomes exact arithmetic, documented in code:** every action is a draw,
kan, chi/pon, or discard; draws + kans ≤ 70 (each consumes one live tile), discards =
draws + kans + chi/pons (every one of those obliges exactly one discard), chi/pons ≤
16 − kans (four melds per seat). Total ≤ 2·70 + 2·16 = 172; the bound constant is
`2 * FULL_TURNS + 2 * MAX_MELDS + 2`.

## D2 — Call density made deterministic: a greedy-call corpus

Random-uniform play exercises chi/pon well but reaches kans rarely and four-kan games
never. Rather than bias the fc generator, add a **deterministic corpus**: a
`playGreedy(seed)` driver that, at every point, plays a call (chi/pon/daiminkan/
ankan/shouminkan) whenever one is offered — picking among calls, and among discards
otherwise, with core's own `createRng(seed)` stream (`nextInt`), so the corpus is
seeded, reproducible, and fc-free.

A directed test folds seeds 0..N (N frozen after empirical verification during
implement) and asserts: every game terminates in ryuukyoku, AND the corpus's action
log union contains every call form — chi, pon, daiminkan, ankan, **and shouminkan**,
closing -03's noted gap (no generative shouminkan coverage). Conservation and
determinism properties also sweep this corpus (cheap: it's ~50 records), so the
call-dense region gets the same invariant treatment as the uniform region.

- *Rejected: statistical assertion inside fc.assert.* fc reseeds per run — a density
  assertion there is flaky by construction; the corpus is deterministic.
- *Rejected: scanning for a random 4-kan game.* Unreachable even greedily with any
  confidence; the dead-wall matrix uses mirrored anchors instead (D5).

## D3 — Termination: structural end-state + the draws+kans identity

`fullGameArb` supplies `choices` at `minLength = bound` so `playRecord` can only stop
on an empty offered set — that the map returns (instead of tripping the bound) remains
the termination proof, now over call-bearing trajectories. The exact-140 assertions
are replaced by assertions that are exact over the widened space:

- end state: `phase === 'ryuukyoku'`, `live` empty, `drawn` null, `mustDiscard`
  false, `claimable` null, `legalActions` empty, `dead.length === 14`;
- **the kan-eats-the-wall identity: #draw actions + #kan actions === FULL_TURNS** —
  each consumed exactly one live tile, so kans arriving means fewer draws, exactly;
- discard identity: `ponds.flat().length` === #discard actions === #draws + #kans +
  #chi/pons (every draw, rinshan, and claim obliges one discard);
- meld identity: total melds across seats === #chi + #pon + #daiminkan + #ankan
  actions (shouminkan replaces in place — counted via its action flipping a pon).

These keep the test non-vacuous the way exact-140 did: a generator that stops early
or a fold that leaks a tile breaks an equality, not a ≤.

## D4 — Conservation: the six-zone flatten at every prefix

`allZones` gains the melds zone: `state.melds.flat().flatMap((m) => m.own)`. Claimed
tiles stay counted in ponds (record.ts's Meld contract), so `own` is the only meld
contribution — the AC's "hands + melds + ponds + drawn + live + dead == 136" verbatim.
The every-prefix sweep and the `numRuns: 50` O(n²) dial stay; the greedy corpus gets
the same sweep at every prefix (directed loop, no fc) so kan-tail plumbing (rinshan
shift, tail move, 14-tile dead wall) is conserved under test where it actually runs.

## D5 — The illegal-claim mutation matrix

Keep `assertMutantThrows` (two-sided: not offered AND fold throws) and grow the
operator set to the AC's four families. Existing operators generalize; two are new.

| Family | Operator | Mechanism |
|---|---|---|
| wrong seat | seat bump (generalized) | rebuild ANY action type with seat+1..3; claims land on non-chi seats / seats without the uses; ankan/shouminkan hit the turn guard |
| wrong tiles | tile retarget (kept) | discard retargeted to an unheld tile |
| wrong tiles | claim-tile retarget (new) | a chi/pon/daiminkan's `tile` moved off the window tile → "the claimable discard is" guard |
| wrong tiles | uses retarget (new) | one element of a claim's `uses` replaced by a random tile; fc.pre-filtered against accidental legality via keyOf, mirroring the discard-retarget precedent |
| stale discard | stale-window shift (new) | for a claim at index i, splice the turn seat's legal draw before it; the claim then meets a closed window → "no claimable discard … stale" |
| out of sequence | type flip, duplicate, append-after-end (kept) | flip restricted to draw/discard indexes; duplicate now doubles claims too (window consumed / uses melded away — throws either way); the append menu gains claim forms |
| dead-wall exhaustion | two mirrored anchors (directed its, not properties) | seed-101033 fifth-kan window (FOUR_KAN_GEOMS mirrored from legal.test.ts, never regenerate): daiminkan mutant throws "no rinshan tile remaining"; seed-1004 haitei post-draw: ankan of the concealed 5p quad throws "on an empty live wall" |

Random play cannot reach four kans or the haitei-quad, so the exhaustion family is
anchored — the same states legal.test.ts proved suppression on, giving the matrix its
non-vacuous material by construction. Mirroring (not importing) follows the keyOf
precedent: suites stay self-contained; a shared helpers module was **rejected**
because the two-sided lock depends on suites not sharing statements of the rules.

## D6 — Scope guards

- **record.ts / legal.ts untouched.** If a property finds an engine bug, that's a
  stop-and-surface moment (progress.md deviation), not a silent fix.
- **No bots.** The greedy driver is test-local policy, ~15 lines, not an AI.
- **drive.ts / app untouched** — nothing here changes any offered shape.
- The suite's charter comment is rewritten: the "claims stay out" paragraph on
  `drawsAndDiscards` dies with the filter; the T-004-01-04 reference resolves.
- Runtime budget: target ≤ ~2s added. Dials: conservation numRuns (50), corpus size
  N (~50), fullGame numRuns (default 100). Trim in that order if needed.
