export const PRODUCT_NAME = 'Tilesword'

export const TILE_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '?',
] as const

export const RULESET = {
  id: 'english-enable',
  label: 'English word-tile rules',
  dictionaryLanguage: 'English',
  wordListName: 'ENABLE',
  quackleLexicon: 'enable1.15',
  boardSize: 15,
  rackSize: 7,
  tileCount: 100,
  blankCount: 2,
} as const

export const ENGLISH_TILE_COUNTS: Record<(typeof TILE_LETTERS)[number], number> = {
  A: 9,
  B: 2,
  C: 2,
  D: 4,
  E: 12,
  F: 2,
  G: 3,
  H: 2,
  I: 9,
  J: 1,
  K: 1,
  L: 4,
  M: 2,
  N: 6,
  O: 8,
  P: 2,
  Q: 1,
  R: 6,
  S: 4,
  T: 6,
  U: 4,
  V: 2,
  W: 2,
  X: 1,
  Y: 2,
  Z: 1,
  '?': 2,
}
