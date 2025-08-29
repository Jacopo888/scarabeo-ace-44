import { TILE_DISTRIBUTION } from '../../../src/types/game'
import { validateMoveLogic } from '../../../src/utils/moveValidation'
import { findNewWordsFormed } from '../../../src/utils/newWordFinder'
import { calculateNewMoveScore } from '../../../src/utils/newScoring'
import { randomUUID } from 'crypto'

interface Tile {
  letter: string
  points: number
  isBlank?: boolean
}

interface PlacedTile extends Tile {
  row: number
  col: number
}

interface PuzzleMove {
  tiles: PlacedTile[]
  words: string[]
  score: number
  startCell?: { row: number, col: number }
  mainWordLength?: number
  lettersUsed?: string[]
}

interface Puzzle {
  id: string
  board: PlacedTile[]  // Only occupied cells
  rack: Tile[]
  topMoves: PuzzleMove[]
}

// TWL06 basic word list for server-side validation
const BASIC_WORD_LIST = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID', 'HAS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE',
  'QUIZ', 'FIZZ', 'BUZZ', 'JAZZ', 'FOXY', 'COZY', 'WAXY', 'ZEST', 'APEX', 'JINX', 'QUAY', 'OXIDE', 'PROXY', 'BLITZ', 'WALTZ', 'ZEBRA', 'DOZEN', 'FUZZY', 'JAZZY', 'DIZZY', 'PIZZA', 'PRIZE', 'FROZE', 'MAIZE', 'BRONZE', 'ENZYME', 'QUARTZ', 'WIZARD', 'OXYGEN', 'ZEPHYR',
  'ACE', 'ACT', 'ADD', 'AGE', 'AID', 'AIM', 'AIR', 'ART', 'ASK', 'ATE', 'BIG', 'BIT', 'BOX', 'BUY', 'CAR', 'CUT', 'DOG', 'EAR', 'EAT', 'EGG', 'END', 'EYE', 'FAR', 'FEW', 'FIT', 'FLY', 'GOT', 'GUN', 'HAT', 'HIT', 'HOT', 'ICE', 'JOB', 'KEY', 'LAY', 'LEG', 'LIE', 'LOT', 'LOW', 'MAN', 'MAP', 'MAY', 'MEN', 'MET', 'MIX', 'OIL', 'PAY', 'PEN', 'PET', 'PIG', 'PIT', 'RAN', 'RAT', 'RED', 'RUN', 'SAT', 'SET', 'SIX', 'SKY', 'SUN', 'TEN', 'TOP', 'TRY', 'WAR', 'WAY', 'WET', 'WIN', 'YES', 'YET', 'ZOO',
  'ABLE', 'BACK', 'BALL', 'BANK', 'BASE', 'BEAR', 'BEAT', 'BEEN', 'BELL', 'BEST', 'BIRD', 'BLOW', 'BLUE', 'BOAT', 'BODY', 'BOOK', 'BORN', 'BOTH', 'BOYS', 'CAME', 'CALL', 'CARE', 'CASE', 'CITY', 'CLUB', 'COLD', 'COME', 'COOL', 'CORN', 'COST', 'CREW', 'DARK', 'DATA', 'DAYS', 'DEAL', 'DESK', 'DOOR', 'DOWN', 'DREW', 'EACH', 'EAST', 'EASY', 'EVEN', 'EVER', 'FACE', 'FACT', 'FAIR', 'FALL', 'FARM', 'FAST', 'FEAR', 'FEEL', 'FEET', 'FELL', 'FELT', 'FILE', 'FILL', 'FIND', 'FINE', 'FIRE', 'FISH', 'FIVE', 'FLAT', 'FLEW', 'FOOD', 'FOOT', 'FORM', 'FOUR', 'FREE', 'FROM', 'FULL', 'GAME', 'GAVE', 'GIRL', 'GIVE', 'GOES', 'GOLD', 'GONE', 'GOOD', 'GREW', 'HAIR', 'HALF', 'HALL', 'HAND', 'HARD', 'HEAD', 'HEAR', 'HEAT', 'HELD', 'HELP', 'HERE', 'HIGH', 'HOLD', 'HOME', 'HOPE', 'HOUR', 'HUGE', 'IDEA', 'INTO', 'ITEM', 'JOIN', 'JUST', 'KEEP', 'KEPT', 'KIND', 'KNEW', 'KNOW', 'LAND', 'LAST', 'LATE', 'LEAD', 'LEFT', 'LESS', 'LIFE', 'LINE', 'LIVE', 'LOAN', 'LONG', 'LOOK', 'LORD', 'LOSE', 'LOST', 'LOVE', 'MADE', 'MAIL', 'MAIN', 'MAKE', 'MANY', 'MARK', 'MASS', 'MEAL', 'MEAN', 'MEET', 'MIND', 'MISS', 'MODE', 'MOON', 'MORE', 'MOST', 'MOVE', 'NAME', 'NEAR', 'NEED', 'NEXT', 'NICE', 'NOON', 'NOTE', 'ONCE', 'ONLY', 'OPEN', 'OVER', 'PACE', 'PAGE', 'PAID', 'PAIR', 'PARK', 'PART', 'PASS', 'PAST', 'PATH', 'PICK', 'PLAN', 'PLAY', 'POOL', 'POOR', 'PULL', 'PUSH', 'RACE', 'RAIN', 'RATE', 'READ', 'REAL', 'ROLE', 'ROOM', 'RULE', 'SAFE', 'SAID', 'SALE', 'SAME', 'SAVE', 'SEAT', 'SEEM', 'SELF', 'SELL', 'SEND', 'SENT', 'SHIP', 'SHOP', 'SHOW', 'SHUT', 'SICK', 'SIDE', 'SIGN', 'SIZE', 'SLOW', 'SNOW', 'SOFT', 'SOIL', 'SOLD', 'SOME', 'SONG', 'SOON', 'SORT', 'SPOT', 'STAR', 'STAY', 'STEP', 'STOP', 'SUCH', 'SURE', 'TAKE', 'TALK', 'TALL', 'TAPE', 'TASK', 'TEAM', 'TELL', 'TERM', 'TEST', 'TEXT', 'THAN', 'THAT', 'THEM', 'THEN', 'THEY', 'THIN', 'THIS', 'TIME', 'TOLD', 'TONE', 'TOOK', 'TOOL', 'TOWN', 'TREE', 'TRUE', 'TURN', 'TYPE', 'UNIT', 'USED', 'USER', 'VARY', 'VERY', 'VIEW', 'VOTE', 'WAIT', 'WALK', 'WALL', 'WANT', 'WARM', 'WASH', 'WAVE', 'WAYS', 'WEAR', 'WEEK', 'WELL', 'WENT', 'WERE', 'WEST', 'WHAT', 'WHEN', 'WIDE', 'WIFE', 'WILD', 'WILL', 'WIND', 'WISE', 'WISH', 'WITH', 'WORD', 'WORK', 'YARD', 'YEAR', 'YOUR'
])

function isValidWord(word: string): boolean {
  return BASIC_WORD_LIST.has(word.toUpperCase())
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function generateConnectedBoard(tileBag: Tile[]): { board: Map<string, PlacedTile>, usedTiles: number } {
  const board = new Map<string, PlacedTile>()
  let usedTiles = 0

  // Start with a word at center (horizontally)
  const centerWords = ['GAME', 'PLAY', 'WORD', 'QUIZ', 'STAR', 'TEAM']
  const word = centerWords[Math.floor(Math.random() * centerWords.length)]
  const startCol = 7 - Math.floor(word.length / 2)
  
  for (let i = 0; i < word.length; i++) {
    const letter = word[i]
    const tileIndex = tileBag.findIndex(t => t.letter === letter)
    if (tileIndex >= 0) {
      const tile = tileBag.splice(tileIndex, 1)[0]
      board.set(`7,${startCol + i}`, {
        ...tile,
        letter,
        row: 7,
        col: startCol + i
      })
      usedTiles++
    }
  }

  // Add crossing words that connect properly
  const crossWords = [
    { word: 'CAT', row: 5, col: 7, direction: 'vertical' },
    { word: 'DOG', row: 8, col: 7, direction: 'vertical' },
    { word: 'TOP', row: 7, col: 4, direction: 'horizontal' },
    { word: 'SUN', row: 6, col: 8, direction: 'vertical' },
    { word: 'RUN', row: 7, col: 10, direction: 'horizontal' }
  ]
  
  // Place 2-3 crossing words that actually connect
  const selectedCrossWords = shuffleArray(crossWords).slice(0, Math.random() > 0.5 ? 3 : 2)
  
  for (const cross of selectedCrossWords) {
    let canPlace = true
    const newPositions: Array<{row: number, col: number, letter: string}> = []
    
    for (let i = 0; i < cross.word.length; i++) {
      const row = cross.direction === 'vertical' ? cross.row + i : cross.row
      const col = cross.direction === 'horizontal' ? cross.col + i : cross.col
      
      if (row < 0 || row >= 15 || col < 0 || col >= 15) {
        canPlace = false
        break
      }
      
      const existing = board.get(`${row},${col}`)
      if (existing) {
        // Must match for crossing
        if (existing.letter !== cross.word[i]) {
          canPlace = false
          break
        }
      } else {
        newPositions.push({ row, col, letter: cross.word[i] })
      }
    }
    
    // Ensure at least one connection
    const hasConnection = cross.word.split('').some((letter, i) => {
      const row = cross.direction === 'vertical' ? cross.row + i : cross.row
      const col = cross.direction === 'horizontal' ? cross.col + i : cross.col
      return board.has(`${row},${col}`)
    })
    
    if (canPlace && hasConnection) {
      for (const pos of newPositions) {
        const tileIndex = tileBag.findIndex(t => t.letter === pos.letter)
        if (tileIndex >= 0) {
          const tile = tileBag.splice(tileIndex, 1)[0]
          board.set(`${pos.row},${pos.col}`, {
            ...tile,
            letter: pos.letter,
            row: pos.row,
            col: pos.col
          })
          usedTiles++
        }
      }
    }
  }

  return { board, usedTiles }
}

function generateTopMoves(board: Map<string, PlacedTile>, rack: Tile[]): PuzzleMove[] {
  const moves: PuzzleMove[] = []
  
  // Generate all possible moves using simplified bot logic
  const adjacentPositions = findAdjacentPositions(board)
  
  for (const [row, col] of adjacentPositions) {
    // Try placing tiles horizontally and vertically
    for (const direction of ['horizontal', 'vertical']) {
      for (let length = 1; length <= Math.min(rack.length, 7); length++) {
        const permutations = generatePermutations(rack, length)
        
        for (const perm of permutations.slice(0, 20)) { // Limit for performance
          const tiles: PlacedTile[] = []
          
          for (let i = 0; i < length; i++) {
            const newRow = direction === 'vertical' ? row + i : row
            const newCol = direction === 'horizontal' ? col + i : col
            
            if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break
            if (board.has(`${newRow},${newCol}`)) continue
            
            tiles.push({
              ...perm.tiles[i],
              row: newRow,
              col: newCol
            })
          }
          
          if (tiles.length === length) {
            // Validate move
            const validation = validateMoveLogic(board, tiles)
            if (validation.isValid) {
              const words = findNewWordsFormed(board, tiles)
              if (words.length > 0 && words.every(w => isValidWord(w.word))) {
                const score = calculateNewMoveScore(words, tiles)
                if (score >= 30) { // Minimum score threshold
                  moves.push({
                    tiles: [...tiles],
                    words: words.map(w => w.word),
                    score
                  })
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Sort by score and return top 5 with hints
  return moves
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(move => {
      // Calculate hints for this move
      const isHorizontal = move.tiles.every(t => t.row === move.tiles[0].row)
      const startTile = isHorizontal
        ? move.tiles.reduce((min, t) => (t.col < min.col ? t : min), move.tiles[0])
        : move.tiles.reduce((min, t) => (t.row < min.row ? t : min), move.tiles[0])
      const startCell = { row: startTile.row, col: startTile.col }
      const mainWordLength = move.words.length > 0 ? Math.max(...move.words.map(w => w.length)) : undefined
      const lettersUsed = move.tiles.map(tile => tile.letter).sort()

      return {
        ...move,
        startCell,
        mainWordLength,
        lettersUsed
      }
    })
}

function findAdjacentPositions(board: Map<string, PlacedTile>): Array<[number, number]> {
  const adjacent = new Set<string>()
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  
  for (const [key] of board) {
    const [row, col] = key.split(',').map(Number)
    for (const [dr, dc] of directions) {
      const newRow = row + dr
      const newCol = col + dc
      if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15) {
        if (!board.has(`${newRow},${newCol}`)) {
          adjacent.add(`${newRow},${newCol}`)
        }
      }
    }
  }
  
  return Array.from(adjacent).map(key => {
    const [row, col] = key.split(',').map(Number)
    return [row, col] as [number, number]
  })
}

function generatePermutations(rack: Tile[], length: number): Array<{ tiles: Tile[], indices: number[] }> {
  const results: Array<{ tiles: Tile[], indices: number[] }> = []
  
  const backtrack = (currentTiles: Tile[], currentIndices: number[], usedIndices: Set<number>) => {
    if (currentTiles.length === length) {
      results.push({ tiles: [...currentTiles], indices: [...currentIndices] })
      return
    }
    
    for (let i = 0; i < rack.length; i++) {
      if (!usedIndices.has(i)) {
        usedIndices.add(i)
        currentTiles.push(rack[i])
        currentIndices.push(i)
        backtrack(currentTiles, currentIndices, usedIndices)
        currentTiles.pop()
        currentIndices.pop()
        usedIndices.delete(i)
      }
    }
  }
  
  backtrack([], [], new Set())
  return results.slice(0, 50) // Limit for performance
}

export function generatePuzzle(): Puzzle {
  const id = randomUUID()
  let attempts = 0
  const maxAttempts = 10
  
  while (attempts < maxAttempts) {
    const tileBag = shuffleArray([...TILE_DISTRIBUTION])
    const { board, usedTiles } = generateConnectedBoard(tileBag)
    
    // Generate rack from remaining tiles
    const rack = tileBag.splice(0, 7)
    
    // Calculate top moves
    const topMoves = generateTopMoves(board, rack)

    if (topMoves.length >= 3 && topMoves[0].score >= 30) {
      // Convert board to array format for API response
      const boardArray: PlacedTile[] = Array.from(board.values())
      
      return {
        id,
        board: boardArray,
        rack: shuffleArray(rack),
        topMoves
      }
    }
    
    attempts++
  }
  
  // Fallback: generate basic puzzle
  const tileBag = shuffleArray([...TILE_DISTRIBUTION])
  const { board } = generateConnectedBoard(tileBag)
  const rack = tileBag.splice(0, 7)
  
  const fallbackTiles = Array.from(board.values()).slice(0, 2)
  const startTile = fallbackTiles[0] ?? { row: 7, col: 7 }
  return {
    id: randomUUID(),
    board: Array.from(board.values()),
    rack: shuffleArray(rack),
    topMoves: [{
      tiles: fallbackTiles,
      words: ['WORD'],
      score: 50,
      startCell: { row: startTile.row, col: startTile.col },
      mainWordLength: 4,
      lettersUsed: rack.slice(0, 2).map(t => t.letter).sort()
    }]
  }
}