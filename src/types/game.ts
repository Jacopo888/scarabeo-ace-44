export interface Tile {
  letter: string
  points: number
  isBlank?: boolean
}

export interface PlacedTile extends Tile {
  row: number
  col: number
}

export interface Player {
  id: string
  name: string
  score: number
  rack: Tile[]
  isBot?: boolean
}

export interface GameState {
  board: Map<string, PlacedTile>
  players: Player[]
  currentPlayerIndex: number
  tileBag: Tile[]
  gameStatus: 'waiting' | 'playing' | 'finished'
  lastMove?: PlacedTile[]
  gameMode?: 'human' | 'bot'
  passCounts?: number[]
}

// Standard Scrabble tile distribution
// Important: create a UNIQUE object for each tile instance to avoid reference sharing.
const makeTiles = (letter: string, points: number, count: number, isBlank = false): Tile[] =>
  Array.from({ length: count }, () => ({ letter, points, isBlank }))

export const TILE_DISTRIBUTION: Tile[] = [
  // A-Z with English Scrabble distribution
  ...makeTiles('A', 1, 9),
  ...makeTiles('B', 3, 2),
  ...makeTiles('C', 3, 2),
  ...makeTiles('D', 2, 4),
  ...makeTiles('E', 1, 12),
  ...makeTiles('F', 4, 2),
  ...makeTiles('G', 2, 3),
  ...makeTiles('H', 4, 2),
  ...makeTiles('I', 1, 9),
  ...makeTiles('J', 8, 1),
  ...makeTiles('K', 5, 1),
  ...makeTiles('L', 1, 4),
  ...makeTiles('M', 3, 2),
  ...makeTiles('N', 1, 6),
  ...makeTiles('O', 1, 8),
  ...makeTiles('P', 3, 2),
  ...makeTiles('Q', 10, 1),
  ...makeTiles('R', 1, 6),
  ...makeTiles('S', 1, 4),
  ...makeTiles('T', 1, 6),
  ...makeTiles('U', 1, 4),
  ...makeTiles('V', 4, 2),
  ...makeTiles('W', 4, 2),
  ...makeTiles('X', 8, 1),
  ...makeTiles('Y', 4, 2),
  ...makeTiles('Z', 10, 1),
  ...makeTiles('', 0, 2, true) // Blank tiles
]