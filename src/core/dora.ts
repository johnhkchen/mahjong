// Riichi rules knowledge: dora indicator → dora kind. The dora is the next tile in the
// indicator's own cycle — suit ranks 1…9 wrapping to 1, winds E→S→W→N→E (1z…4z),
// dragons haku→hatsu→chun→haku (5z…7z). Winds and dragons are separate cycles: 4z→1z,
// never 4z→5z. Kind-level only — physical indicator tiles are decoded upstream with
// kindOf(); ura-dora indicators use this same mapping.

import { suitOf, type TileKind } from './tiles'

export function doraKindOf(indicator: TileKind): TileKind {
  const suit = suitOf(indicator)
  // Leading digit: rank for numbered kinds, honor index 1-7 for z (rankOf nulls on honors).
  const n = Number(indicator[0])
  if (suit !== 'z') return `${(n % 9) + 1}${suit}` as TileKind
  if (n <= 4) return `${(n % 4) + 1}z` as TileKind
  return `${((n - 4) % 3) + 5}z` as TileKind
}
