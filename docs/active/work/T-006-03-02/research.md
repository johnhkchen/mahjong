# T-006-03-02 — call-policy — Research

The ticket: the CALL branch of the bot policy — take shanten-cutting, yaku-preserving
chi/pon/kan; pass claims that would strand a yakuless open hand; always take a legal
ron. This maps what exists: the decision points, the offered-set shapes, the policy
module the branch grows, the yaku vocabulary "yaku-preserving" is defined against, and
the seams that will consume it.

## 1. Where the call decisions live (legal.ts state classes)

`legalActions(state)` enumerates five state classes (legal.ts:250–316). The ones the
discard policy (T-006-03-01) deliberately does NOT govern:

- **Pre-draw with an open claim window** (`drawn === null`, `claimable !== null`):
  the offered set is `[draw(turn seat), ...rons, ...pons, ...daiminkans, ...chis]` in
  that frozen order. Rons and pon/daiminkan offers may belong to ANY non-discarder
  seat (rotation order from the discarder's right — atamahane order); chi offers
  belong only to the discarder's left (`window.seat + 1`), which is always the turn
  seat. The draw at the head belongs to the turn seat and is the only "decline"
  continuation — folding it lets the window go stale.
- **Ryuukyoku** (`phase === 'ryuukyoku'`): the offered set is ONLY the houtei rons
  against the reconstructed final discard (usually empty). No draw exists here.
- **Post-draw kan offers**: ankan/shouminkan offers sit in the turn seat's post-draw
  offered set after the 14 discards and the tsumo. `discardPolicy` passes them
  through unchosen by design (policy.ts header: "kan offers pass through unchosen").
- **The turn seat's own pre-draw ron**: discardPolicy returns the draw over it —
  an explicit deferral, pinned by a test (policy.test.ts:216, "the deliberate
  deferral to the call branch (T-006-03-02)").

`discardPolicy` throws RangeError on any offered set holding no draw/discard/tsumo
for its seat, with a message naming this ticket (policy.ts:113–115). Claim windows
consulted for a NON-turn seat are exactly that throw today.

## 2. The offered-set contract the branch selects from

- Offers are per physical copy combination: a seat holding three copies of the
  window kind gets three pon offers (differing in `uses`); every chi shape × copy
  pair is its own offer, shapes low-rank ascending, `uses` = [lower, higher] in hand
  order (legal.ts claimOffers).
- Ron offers are already fully gated by legality: completion (isAgari), basic
  discard furiten, and the ONE-YAKU GATE (`winYaku(...).length === 0` withholds the
  offer). **An offered ron is always a legal, yaku-bearing win** — "always take a
  legal ron" needs no re-derivation, only selection.
- Daiminkan offers exist only while `kanAllowed` (rinshan remaining, live wall
  non-empty); at most one seat can ever hold one (copy arithmetic).
- There is NO pass action in the vocabulary. Declining a claim = the turn seat's
  draw folding (drive.ts passClaim: "the draw at the head — the default continuation
  whose fold lets the window go stale"). The AC's "selects the pass/next-draw"
  matches: the returned element for a decline is the offered draw — which belongs to
  the TURN seat, not necessarily the declining seat. In ryuukyoku there is no draw:
  a seat holding no houtei ron has literally nothing in the offered set.

## 3. The policy module this ticket grows

`src/core/policy.ts` — one export, `discardPolicy(view, offered)`. Frozen postures
the call branch must match (policy.ts header + T-006-03-01 design.md §5):

- Typed against **SeatView**, never TableState (fair-play is structural); the driver
  supplies both view and offered from the same folded state; consistency trusted.
- **Selects** elements of `offered`, never constructs actions — "element of the
  offered set" holds by construction; the same reference is returned on every call
  with the same arguments (T-006-03-04's byte-identical replay leans on this).
- No RNG, no ambient reads; inputs never mutated.
- Throw RangeError at decision points it does not govern (the shanten/waits
  posture: consultation outside the contract is driver corruption, not a pass).
- T-006-03-01's design.md anticipated "most likely a sibling `callPolicy` for claim
  windows, composed at the drive seam (T-006-03-03), which already distinguishes
  own-turn points from claim windows"; extend-only — discardPolicy's three arms and
  its throw are frozen.

## 4. Shanten arithmetic for "shanten-cutting"

`shanten(concealed: TileKind[], melds)` (min of standard/chiitoi/kokushi; melded
hands read standardShanten only) accepts exactly two arities per meld count:
13 − 3m (waiting) and 14 − 3m (drawn). The call arithmetic lands on legal arities:

- **Before a claim**: the seat's concealed hand is 13 − 3m (pre-draw, no drawn tile).
- **After chi/pon**: two `uses` leave → 11 − 3m = 14 − 3(m+1), the DRAWN arity for
  m+1 melds — a legal query. Its value equals "shanten after the claim, with the
  claim discard still owed"; since a 14-arity hand always has a discard preserving
  its shanten, this IS the best reachable post-claim-discard shanten.
- **After daiminkan**: three `uses` leave → 10 − 3m = 13 − 3(m+1), the waiting
  arity — also legal (the rinshan draw then arrives on top).
- Chiitoi/kokushi arms silently drop out at the first meld (shanten.ts:193–198) —
  calling out of a chiitoi-shaped hand can RAISE effective shanten even when the
  standard form improves; the min-of-three combinator handles this automatically as
  long as the pre-call baseline is `shanten` (not `standardShanten`).

## 5. The yaku vocabulary "yaku-preserving" reads

The catalog (yaku.ts) plus yakuman (yakuman.ts). What opening the hand kills vs
keeps — decisive for "strand a yakuless open hand":

- **Closed-only** (isMenzen gates, ankan keeps closed): menzen-tsumo, pinfu,
  iipeikou, ryanpeikou, chiitoitsu (implicitly — any call breaks the form). The
  riichi family does not exist in the vocabulary yet.
- **Open-compatible**: tanyao (**kuitan explicitly allowed** — yaku.ts:241), all
  five yakuhai (haku/hatsu/chun 5z/6z/7z, seat wind `${seat+1}z`, round wind — fixed
  '1z' in both record.ts and legal.ts, re-stated not imported), sanshoku (both),
  ittsuu, chanta, junchan, toitoi, sanankou, sankantsu, honroutou, shousangen,
  honitsu, chinitsu, plus the circumstantial haitei/houtei/rinshan/chankan and the
  open-compatible yakuman.
- **The one-yaku win gate is structural**: legality withholds yakuless tsumo/ron
  offers and the fold throws on a yakuless win action (record.ts applyWinTail). An
  open hand with no reachable yaku can reach tenpai but can never be OFFERED a win
  except by houtei/haitei/rinshan luck — "stranded" is a real, mechanical state,
  not just bad play.
- **No reachability machinery exists.** yakuOf/standardYakuOf evaluate COMPLETED
  hands only (they throw on non-completion via decomposeAgari); there is no ukeire,
  no partial-hand yaku probe. Whatever predicate answers "does a yaku remain
  reachable after this call?" must be built by this ticket, and the Design phase
  must pick its shape and precision.

## 6. What SeatView gives the predicate

The policy can read: own hand (TileIds) + own drawn, ALL seats' melds and ponds,
doras/indicators, wallCount, turn, claimable, mustDiscard, seat. Enough for:
shanten-after-call (own hand, own melds), yakuhai anchors (own copies of value
kinds; seat is on the view; round wind must be re-stated '1z' per the legal.ts
precedent), suit/simple composition for tanyao/honitsu-style checks. Hidden: other
hands, wall order — nothing the branch needs.

## 7. The consuming seams

- **drive.ts (app)**: today bot seats auto-pass every claim window and win offer
  (placeholder doctrine, drive.ts header); `claimChoices`/`passClaim`/`forcedAction`
  form the seam T-006-03-03 rewires to route non-PLAYER decisions to the policy.
  Multiple-ron arbitration (atamahane) is the RECORDER's job (record.ts multiple-ron
  convention); ronOffers order is already atamahane order, so a driver takes the
  first offered ron.
- **T-006-03-04 harness**: all-four-botted determinism + termination over seeds.
  Note a termination hazard the call branch introduces: calls do not consume the
  live wall, so a policy that calls too eagerly could in principle lengthen games;
  the ACTION_BOUND arithmetic in policy.test.ts (2·FULL_TURNS + 2·4·SEAT_COUNT + 2)
  already budgets 4 calls per seat plus kan slack — verify it still holds when the
  sweep drives claims.

## 8. Test conventions to follow

- policy.test.ts: `tileSource()` mpsz fixture parser; `viewOf()` SeatView literal
  builder; hand-built offered arrays for arm/tie-break pinning; a seeded whole-game
  sweep driven by the policy itself (dynamics.test.ts driver mold — refold the
  record each step), plain throws inside the loop with one expect per game (the
  T-006-01-02 perf lesson); fast-check for sampled seeds (small numRuns budget).
- purity.test.ts enforces zero DOM/platform imports in core; flat same-directory
  imports.
- `just test` runs vitest over src/core; `just check` runs svelte-check + tsc.

## 9. Constraints and open questions for Design

- How much of the branch lives in one `callPolicy` vs arms folded elsewhere; whether
  own-turn ankan/shouminkan selection is in scope (the AC's tests name chi/pon
  accept/decline and ron only; "chi/pon/kan" in the context says kan claims are —
  daiminkan at minimum sits in the claim window).
- The precision of the yaku-reachability predicate (exact search is expensive and
  untestable by eye; a documented conservative anchor-check is the teachable shape —
  Design must choose and justify).
- Pass semantics for a non-turn seat (return the offered draw — another seat's
  action) and the ryuukyoku no-ron case (nothing to select: throw or never-consult
  contract, mirroring discardPolicy's posture).
- Whether accepting a call requires STRICT shanten cut (the AC's "lowers shanten"
  says yes for accept; kan forms may need their own rule — a daiminkan never lowers
  standard shanten below the pon of the same tiles, and ankan is shanten-neutral).
