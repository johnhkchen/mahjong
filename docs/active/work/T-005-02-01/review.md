# T-005-02-01 — tsumo-ron-actions-and-fold — Review

The handoff: what changed, how it is covered, what a human should look at.

## 1. What changed

| File | Change |
|---|---|
| `src/core/record.ts` | +~200 lines. HandAction gains `tsumo` (no tile — wall authority) and `ron` (records the claimed tile — the chi/pon redundancy rule). TableState gains `drawnFrom: 'wall' \| 'rinshan' \| null` (lockstep with `drawn`) and `win` (discriminated tsumo/ron union: winner, tile, yaku, ron's `from`), and `phase` widens with `'agari'`. New steps: `applyTsumo`, `applyRon`, shared `applyWinTail` (assembles the Win, calls yakuOf eagerly, throws on non-completion and on the one-yaku gate), `windKindOf`, `ROUND_WIND = '1z'`. applyAction: ended-guard carve-out (only a ron may fold out of ryuukyoku — the houtei arm), two dispatch cases. Docs: freeze-block win bullets, THE MULTIPLE-RON CONVENTION, chankan-unreachable notes, phase/turn-cycle updates. |
| `src/core/win.test.ts` | NEW, 24 tests — see §2. |
| `src/core/record.test.ts` | One TableState literal gains `drawnFrom: null, win: null`. |
| `src/core/dynamics.test.ts` | Type-exhaustiveness only: `countTypes` literal and `withSeat` switch gain tsumo/ron entries (behavior-neutral). |

Commits: 457a21b (plumbing), 6c6272a (vocabulary + steps), 541edfc (suite).
Verification: 385/385 tests across 16 files, svelte-check/tsc clean,
`just build` produces the self-contained single file.

## 2. Acceptance criteria → coverage

- **Ended phase carrying winner, winning tile, yaku names** — tsumo and ron
  describe blocks assert the exact `win` object (including yaku list order,
  which is yakuOf's frozen contract), `phase === 'agari'`, and the winning
  tile's zone (tsumo: still `drawn`; ron: still the discarder's pond),
  plus 136-tile conservation on every win state.
- **Replay reproduces the identical win** — fold-twice determinism over all
  five win logs (tsumo, ron, houtei, haitei, rinshan): deep-equal states,
  fresh `win`/`yaku` arrays.
- **Corrupt win actions throw loudly** — ten cases: wrong-seat tsumo, tsumo
  before drawing, tsumo while owing a claim discard, non-completing tsumo,
  ron with no window, ron on a stale window, ron of own discard, ron tile ≠
  fresh discard, non-completing ron, yakuless ron (the one-yaku gate's
  message names the convention). All RangeError with the action index.
- **Multiple-ron convention documented in record.ts and exercised** — the
  freeze block's MULTIPLE-RON paragraph (single winner; recorder picks by
  atamahane; second ron throws; double-ron noted as a possible extend-only
  widening); test folds a valid ron then asserts a second ron by each other
  seat throws 'already ended in agari'.

Beyond the AC: houtei (ryuukyoku→agari, guards intact, only ron crosses the
end), haitei (empty wall, wall-source), rinshan (drawnFrom plumbing observed
directly, rinshan kaihou in the yaku), `legalActions(agari) === []`.

## 3. Design decisions a reviewer should weigh

1. **Houtei folds OUT of ryuukyoku** against a reconstructed window (`turn`
   stays at the last discarder; its pond's last tile is the final discard).
   Chosen over retaining `claimable` into the ended state because it keeps
   "an ended hand never holds a window" true and every existing test/fold
   byte-identical. Cost: 'ryuukyoku' is now "provisionally ended" —
   documented on `phase`. T-005-02-02 must mirror this carve-out when it
   offers houtei ron (its `phase !== 'playing'` early-return needs the same
   exception).
2. **Round wind is a fold constant ('1z')** — records are single hands; the
   match epic threads the real round wind in later (extend-only). Until
   then yakuhai-round-wind fires only for East — correct for every
   East-round hand, conservative otherwise.
3. **Single-winner multiple-ron** — the fold cannot know who else could win
   (that is waits/legality knowledge); the recorder picks. Head-bump
   selection lands in the app driver (-03).
4. **Chankan stays unreachable** — shouminkan folds atomically; robbing it
   needs an announce/complete split. Documented at both the vocabulary and
   the shouminkan step. yaku.ts's chankan predicate is dormant, not dead.

## 4. Test-coverage gaps (known, accepted)

- **No two-genuine-winners fixture** for the multiple-ron test (dealt tenpai
  ≈ 1/10,000 per seat put it out of mining range). The convention is
  exercised via second-ron-throws; a directed fixture would strengthen it to
  "either seat's ron folds alone". Cheap to add if a future search tool
  (shanten) makes mining directed hands easy.
- **Open-hand and yakuman wins never reach the fold in tests** — all mined
  winners are closed tsumogiri hands (pinfu/menzen-tsumo family). yakuOf's
  own suite covers open/yakuman aggregation; the fold passes `melds[winner]`
  straight through (the rinshan fixture at least exercises a non-empty meld
  list via its ankan). -04's random-driver property suite will widen organic
  coverage once -02 makes wins offerable.
- **applyWinTail's catch re-wraps ANY yakuOf RangeError** as "does not
  complete" — including its arity/desync guards, which cannot fire here
  (hand arithmetic guarantees 14−3m tiles; the winning kind is appended by
  construction). If yakuOf ever grows new throw conditions this message
  could mislead; acceptable while both modules live in core.

## 5. Open concerns / handoffs

- **-02 must not offer what the fold rejects**: yakuless completions
  (yakuOf `[]`), furiten rons, and must offer houtei through the ryuukyoku
  carve-out and tsumo on rinshan draws (`drawnFrom` is the state to read).
- **-03's driver owns atamahane** when several rons are simultaneously
  legal, per the documented convention.
- **Scoring epic**: `win.yaku` carries names only (no han/fu anywhere) —
  the charter boundary holds; the scoring epic layers valuation on top.
- **Taiwan 16-tile variant** (owner's post-DoD direction): the win-fold
  conventions frozen here (single winner, derivation-not-log, ended-state
  shape) are ruleset-agnostic; only yakuOf and the arity constants are
  Riichi-specific, and both stay behind the engine boundary as designed.
- No TODOs left in code; no skipped tests; nothing needs human intervention
  before -02 proceeds.
