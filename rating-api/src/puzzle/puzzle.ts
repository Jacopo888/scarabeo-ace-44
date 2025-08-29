import { TILE_DISTRIBUTION } from '../../../src/types/game'
import { validateMoveLogic } from '../../../src/utils/moveValidation'
import { findNewWordsFormed } from '../../../src/utils/newWordFinder'
import { calculateNewMoveScore } from '../../../src/utils/newScoring'
import { randomUUID } from 'crypto'

// Enhanced word list for legal puzzle generation
const ENHANCED_WORD_LIST = new Set([
  // Original basic words
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID', 'HAS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE',
  'QUIZ', 'FIZZ', 'BUZZ', 'JAZZ', 'FOXY', 'COZY', 'WAXY', 'ZEST', 'APEX', 'JINX', 'QUAY', 'OXIDE', 'PROXY', 'BLITZ', 'WALTZ', 'ZEBRA', 'DOZEN', 'FUZZY', 'JAZZY', 'DIZZY', 'PIZZA', 'PRIZE', 'FROZE', 'MAIZE', 'BRONZE', 'ENZYME', 'QUARTZ', 'WIZARD', 'OXYGEN', 'ZEPHYR',
  'ACE', 'ACT', 'ADD', 'AGE', 'AID', 'AIM', 'AIR', 'ART', 'ASK', 'ATE', 'BIG', 'BIT', 'BOX', 'BUY', 'CAR', 'CUT', 'DOG', 'EAR', 'EAT', 'EGG', 'END', 'EYE', 'FAR', 'FEW', 'FIT', 'FLY', 'GOT', 'GUN', 'HAT', 'HIT', 'HOT', 'ICE', 'JOB', 'KEY', 'LAY', 'LEG', 'LIE', 'LOT', 'LOW', 'MAN', 'MAP', 'MAY', 'MEN', 'MET', 'MIX', 'OIL', 'PAY', 'PEN', 'PET', 'PIG', 'PIT', 'RAN', 'RAT', 'RED', 'RUN', 'SAT', 'SET', 'SIX', 'SKY', 'SUN', 'TEN', 'TOP', 'TRY', 'WAR', 'WAY', 'WET', 'WIN', 'YES', 'YET', 'ZOO',
  // Long words for initial placement (>5 letters)
  'PLAYER', 'POINTS', 'BOARDS', 'LETTER', 'CHANCE', 'DOUBLE', 'TRIPLE', 'SCORED', 'WINNER', 'PLACED', 'MASTER', 'EXPERT', 'PUZZLE', 'CHALLENGE', 'STRATEGY', 'COMPUTER', 'VOCABULARY', 'ALPHABET', 'SENTENCE', 'CROSSWORD', 'SPELLING',
  'AMAZING', 'ARTIST', 'ANSWER', 'ALWAYS', 'AROUND', 'ALMOST', 'BETTER', 'BEFORE', 'BRINGS', 'BEYOND', 'BRIDGE', 'BRIGHT', 'CREATES', 'CLASSIC', 'CENTRAL', 'CHANGE', 'CHOICE', 'CIRCLE', 'GOLDEN', 'GLOBAL', 'GROUND', 'GARDEN', 'GATHER', 'GIVING', 'HELPER', 'HAPPEN', 'HIGHER', 'HANDLE', 'HEARTS', 'HOSTED'
])

// Words organized by starting letter for connection logic
const WORDS_BY_LETTER: Record<string, string[]> = {
  'A': ['AMAZING', 'ARTIST', 'ANSWER', 'ALWAYS', 'AROUND', 'ALMOST', 'ABLE', 'ACE', 'ACT', 'ADD', 'AGE', 'AID', 'AIM', 'AIR', 'ART', 'ASK', 'ATE'],
  'B': ['BETTER', 'BEFORE', 'BRINGS', 'BEYOND', 'BRIDGE', 'BRIGHT', 'BIG', 'BIT', 'BOX', 'BUY', 'BOY', 'BUZZ', 'BLITZ', 'BRONZE'],
  'C': ['CREATES', 'CLASSIC', 'CENTRAL', 'CHANGE', 'CHOICE', 'CIRCLE', 'CAR', 'CUT', 'CAN', 'COZY'],
  'D': ['DOUBLE', 'DURING', 'DIRECT', 'DECIDE', 'DESIGN', 'DETAIL', 'DOG', 'DAY', 'DID', 'DOZEN', 'DIZZY'],
  'E': ['EXPERT', 'ENABLE', 'ENERGY', 'ENOUGH', 'EASILY', 'ENTER', 'EAR', 'EAT', 'EGG', 'END', 'EYE', 'ENZYME'],
  'F': ['FUTURE', 'FRIEND', 'FOLLOW', 'FAMOUS', 'FIGURE', 'FINISH', 'FAR', 'FEW', 'FIT', 'FLY', 'FIZZ', 'FOXY', 'FUZZY', 'FROZE'],
  'G': ['GOLDEN', 'GLOBAL', 'GROUND', 'GARDEN', 'GATHER', 'GIVING', 'GOT', 'GUN', 'GET'],
  'H': ['HELPER', 'HAPPEN', 'HIGHER', 'HANDLE', 'HEARTS', 'HOSTED', 'HAT', 'HIT', 'HOT', 'HAS', 'HIM', 'HIS', 'HOW'],
  'I': ['INSIDE', 'INDEED', 'ISLAND', 'IMPACT', 'INVITE', 'INFORM', 'ICE', 'ITS'],
  'J': ['JOINED', 'JUNGLE', 'JUMPED', 'JUNIOR', 'JOYFUL', 'JACKET', 'JOB', 'JAZZ', 'JAZZY', 'JINX'],
  'L': ['LONGER', 'LOVELY', 'LISTEN', 'LEADER', 'LITTLE', 'LETTER', 'LAY', 'LEG', 'LIE', 'LOT', 'LOW'],
  'M': ['MASTER', 'MAKING', 'MOMENT', 'MODERN', 'MOBILE', 'MENTAL', 'MAN', 'MAP', 'MAY', 'MEN', 'MET', 'MIX', 'MAIZE'],
  'P': ['PLAYER', 'POINTS', 'PUZZLE', 'PRETTY', 'PLACED', 'PERSON', 'PAY', 'PEN', 'PET', 'PIG', 'PIT', 'PUT', 'PIZZA', 'PRIZE', 'PROXY'],
  'Q': ['QUALITY', 'QUICKLY', 'QUESTION', 'QUIETLY', 'QUARTER', 'QUEEN', 'QUIZ', 'QUAY', 'QUARTZ'],
  'R': ['REALLY', 'RETURN', 'RESULT', 'RECORD', 'REASON', 'RECENT', 'RAN', 'RAT', 'RED', 'RUN'],
  'S': ['SIMPLE', 'STRONG', 'SECOND', 'SYSTEM', 'SINGLE', 'SOUNDS', 'SAT', 'SET', 'SIX', 'SKY', 'SUN', 'SAY', 'SHE', 'SEE', 'SPELLING', 'STRATEGY', 'SCORED'],
  'T': ['TRYING', 'TURTLE', 'TRAVEL', 'TALENT', 'THANKS', 'TISSUE', 'TEN', 'TOP', 'TRY', 'TWO', 'TOO', 'THE', 'TRIPLE'],
  'W': ['WINNER', 'WONDER', 'WINDOW', 'WORKED', 'WRITER', 'WEEKLY', 'WAR', 'WAY', 'WET', 'WIN', 'WAS', 'WHO', 'WIZARD', 'WALTZ'],
  'Z': ['ZEBRA', 'ZONAL', 'ZOO', 'ZEST', 'ZEPHYR']
}

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

function isValidWord(word: string): boolean {
  return ENHANCED_WORD_LIST.has(word.toUpperCase())
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function getRandomWordByLength(minLength: number): string | null {
  const longWords = Object.values(WORDS_BY_LETTER)
    .flat()
    .filter(word => word.length >= minLength)
  
  return longWords.length > 0 
    ? longWords[Math.floor(Math.random() * longWords.length)]
    : null
}

function findWordsStartingWith(letter: string): string[] {
  return WORDS_BY_LETTER[letter] || []
}

function placeWordOnBoard(
  board: Map<string, PlacedTile>,
  word: string,
  startRow: number,
  startCol: number,
  direction: 'horizontal' | 'vertical',
  tileBag: Tile[]
): boolean {
  const positions: Array<{row: number, col: number, letter: string}> = []
  
  // Calculate all positions
  for (let i = 0; i < word.length; i++) {
    const row = direction === 'vertical' ? startRow + i : startRow
    const col = direction === 'horizontal' ? startCol + i : startCol
    
    if (row < 0 || row >= 15 || col < 0 || col >= 15) {
      return false // Out of bounds
    }
    
    positions.push({ row, col, letter: word[i] })
  }
  
  // Check conflicts and find connections
  let hasConnection = false
  for (const pos of positions) {
    const existing = board.get(`${pos.row},${pos.col}`)
    if (existing) {
      if (existing.letter !== pos.letter) {
        return false // Conflict
      }
      hasConnection = true
    }
  }
  
  // If not the first word, must connect
  if (board.size > 0 && !hasConnection) {
    return false
  }
  
  // Place new letters
  for (const pos of positions) {
    const key = `${pos.row},${pos.col}`
    if (!board.has(key)) {
      const tileIndex = tileBag.findIndex(t => t.letter === pos.letter)
      if (tileIndex >= 0) {
        const tile = tileBag.splice(tileIndex, 1)[0]
        board.set(key, {
          ...tile,
          letter: pos.letter,
          row: pos.row,
          col: pos.col
        })
      } else {
        return false // Don't have the letter in bag
      }
    }
  }
  
  return true
}

function generateLegalBoard(tileBag: Tile[]): { board: Map<string, PlacedTile>, wordsGenerated: string[] } {
  const board = new Map<string, PlacedTile>()
  const wordsGenerated: string[] = []
  
  // 1. Choose a long initial word (>5 letters) and place it in center
  const firstWord = getRandomWordByLength(6)
  if (!firstWord) {
    throw new Error('Unable to find valid initial word')
  }
  
  const startCol = 7 - Math.floor(firstWord.length / 2)
  if (!placeWordOnBoard(board, firstWord, 7, startCol, 'horizontal', tileBag)) {
    throw new Error('Unable to place initial word')
  }
  wordsGenerated.push(firstWord)
  
  // 2. Generate 6 additional words by connecting them
  for (let wordCount = 1; wordCount < 7; wordCount++) {
    // Choose a random letter from already placed words
    const placedTiles = Array.from(board.values())
    const randomTile = placedTiles[Math.floor(Math.random() * placedTiles.length)]
    const connectingLetter = randomTile.letter
    
    // Find words that start with that letter
    const possibleWords = findWordsStartingWith(connectingLetter)
    if (possibleWords.length === 0) continue
    
    const newWord = possibleWords[Math.floor(Math.random() * possibleWords.length)]
    
    // Try to place the word in different positions
    let placed = false
    const attempts = [
      // Above
      { row: randomTile.row - 1, col: randomTile.col, direction: 'vertical' as const },
      // Below  
      { row: randomTile.row + 1, col: randomTile.col, direction: 'vertical' as const },
      // Left
      { row: randomTile.row, col: randomTile.col - 1, direction: 'horizontal' as const },
      // Right
      { row: randomTile.row, col: randomTile.col + 1, direction: 'horizontal' as const },
    ]
    
    for (const attempt of attempts) {
      const boardCopy = new Map(board)
      const tileBagCopy = [...tileBag]
      
      if (placeWordOnBoard(boardCopy, newWord, attempt.row, attempt.col, attempt.direction, tileBagCopy)) {
        // Success - update the real board
        board.clear()
        boardCopy.forEach((tile, key) => board.set(key, tile))
        tileBag.splice(0, tileBag.length, ...tileBagCopy)
        wordsGenerated.push(newWord)
        placed = true
        break
      }
    }
    
    if (!placed) {
      // Try with shorter words if we can't place
      const shorterWords = findWordsStartingWith(connectingLetter)
        .filter(w => w.length <= 4)
      
      for (const shortWord of shorterWords) {
        for (const attempt of attempts) {
          const boardCopy = new Map(board)
          const tileBagCopy = [...tileBag]
          
          if (placeWordOnBoard(boardCopy, shortWord, attempt.row, attempt.col, attempt.direction, tileBagCopy)) {
            board.clear()
            boardCopy.forEach((tile, key) => board.set(key, tile))
            tileBag.splice(0, tileBag.length, ...tileBagCopy)
            wordsGenerated.push(shortWord)
            placed = true
            break
          }
        }
        if (placed) break
      }
    }
  }
  
  return { board, wordsGenerated }
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
  const maxAttempts = 5
  
  while (attempts < maxAttempts) {
    try {
      const tileBag = shuffleArray([...TILE_DISTRIBUTION])
      const { board, wordsGenerated } = generateLegalBoard(tileBag)
      
      // Create player rack
      const rack = tileBag.splice(0, 7)
      
      // Use basic bot logic to find best moves
      const allMoves = generateTopMoves(board, rack)
      const bestMoves = allMoves
        .filter(move => move.score >= 20)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
      
      if (bestMoves.length > 0) {
        const topMoves: PuzzleMove[] = bestMoves.map(move => {
          const isHorizontal = move.tiles.every(t => t.row === move.tiles[0].row)
          const startTile = isHorizontal
            ? move.tiles.reduce((min, t) => (t.col < min.col ? t : min), move.tiles[0])
            : move.tiles.reduce((min, t) => (t.row < min.row ? t : min), move.tiles[0])
          
          return {
            tiles: move.tiles,
            words: move.words,
            score: move.score,
            startCell: { row: startTile.row, col: startTile.col },
            mainWordLength: move.words.length > 0 ? Math.max(...move.words.map(w => w.length)) : undefined,
            lettersUsed: move.tiles.map(t => t.letter).sort()
          }
        })
        
        return {
          id,
          board: Array.from(board.values()),
          rack: shuffleArray(rack),
          topMoves
        }
      }
    } catch (error) {
      console.warn(`Legal puzzle generation attempt ${attempts + 1} failed:`, error)
    }
    
    attempts++
  }
  
  // Fallback to simple generation if legal method fails
  console.warn('Using fallback puzzle generation')
  const tileBag = shuffleArray([...TILE_DISTRIBUTION])
  const board = new Map<string, PlacedTile>()
  
  // Simple center word
  const word = 'PUZZLE'
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
    }
  }
  
  const rack = tileBag.splice(0, 7)
  const boardArray = Array.from(board.values())
  
  return {
    id: randomUUID(),
    board: boardArray,
    rack: shuffleArray(rack),
    topMoves: [{
      tiles: boardArray.slice(0, 2),
      words: ['WORD'],
      score: 40,
      startCell: { row: 7, col: 7 },
      mainWordLength: 4,
      lettersUsed: rack.slice(0, 2).map(t => t.letter).sort()
    }]
  }
}