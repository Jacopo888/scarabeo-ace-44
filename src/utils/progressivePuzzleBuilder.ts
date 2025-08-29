import { Tile, PlacedTile, TILE_DISTRIBUTION } from '@/types/game'
import { Puzzle, PuzzleMove } from '@/types/puzzle'
import { ScrabbleBot } from '@/ai/ScrabbleBot'

export interface PuzzleConstructionStep {
  type: 'INITIAL_WORD' | 'CONNECTED_WORD' | 'FINDING_BEST_MOVE'
  wordAdded?: string
  position?: { row: number, col: number }
  direction?: 'horizontal' | 'vertical'
  stepNumber?: number
  totalSteps?: number
}

export interface ProgressivePuzzleState {
  board: Map<string, PlacedTile>
  rack: Tile[]
  wordsGenerated: string[]
  currentStep: PuzzleConstructionStep
  isComplete: boolean
  bestMove?: PuzzleMove
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function getRandomLongWord(isValidWord: (word: string) => boolean): string | null {
  const longWords = [
    'PLAYING', 'SCRABBLE', 'LETTERS', 'POINTS', 'BOARDS', 'DOUBLE', 'TRIPLE', 
    'WINNER', 'MASTER', 'EXPERT', 'PUZZLE', 'CHALLENGE', 'STRATEGY', 'ALPHABET',
    'CROSSWORD', 'SPELLING', 'VOCABULARY', 'DICTIONARY', 'COMPUTER', 'SENTENCE'
  ]
  
  const validWords = longWords.filter(word => 
    word.length >= 6 && isValidWord(word)
  )
  
  return validWords.length > 0 
    ? validWords[Math.floor(Math.random() * validWords.length)] 
    : null
}

function findWordsStartingWith(letter: string, isValidWord: (word: string) => boolean, minLength = 3): string[] {
  const wordsByLetter: Record<string, string[]> = {
    'A': ['AMAZING', 'ARTIST', 'ANSWER', 'ALWAYS', 'AROUND', 'ALMOST', 'AFTER', 'ABOUT', 'AGAIN'],
    'B': ['BETTER', 'BEFORE', 'BRINGS', 'BEYOND', 'BRIDGE', 'BRIGHT', 'BOARD', 'BUILD', 'BASIC'],
    'C': ['CREATES', 'CLASSIC', 'CENTRAL', 'CHANGE', 'CHOICE', 'CIRCLE', 'CHESS', 'CLIMB', 'CLEAN'],
    'D': ['DOUBLE', 'DURING', 'DIRECT', 'DECIDE', 'DESIGN', 'DETAIL', 'DANCE', 'DREAM', 'DRIVE'],
    'E': ['EXPERT', 'ENABLE', 'ENERGY', 'ENOUGH', 'EASILY', 'ENTER', 'EMPTY', 'EAGLE', 'EARTH'],
    'F': ['FUTURE', 'FRIEND', 'FOLLOW', 'FAMOUS', 'FIGURE', 'FINISH', 'FIELD', 'FOCUS', 'FORCE'],
    'G': ['GOLDEN', 'GLOBAL', 'GROUND', 'GARDEN', 'GATHER', 'GIVING', 'GREAT', 'GROUP', 'GRACE'],
    'H': ['HELPER', 'HAPPEN', 'HIGHER', 'HANDLE', 'HEARTS', 'HOSTED', 'HOUSE', 'HUMAN', 'HORSE'],
    'I': ['INSIDE', 'INDEED', 'ISLAND', 'IMPACT', 'INVITE', 'INFORM', 'IMAGE', 'IDEAL', 'INDEX'],
    'J': ['JOINED', 'JUNGLE', 'JUMPED', 'JUNIOR', 'JOYFUL', 'JACKET', 'JAPAN', 'JUDGE', 'JUICE'],
    'K': ['KEEPER', 'KINDLY', 'KNIGHT', 'KITCHEN', 'KINGDOM', 'KNOWN', 'KNIFE', 'KNOCK'],
    'L': ['LONGER', 'LOVELY', 'LISTEN', 'LEADER', 'LITTLE', 'LETTER', 'LIGHT', 'LEARN', 'LARGE'],
    'M': ['MASTER', 'MAKING', 'MOMENT', 'MODERN', 'MOBILE', 'MENTAL', 'MONEY', 'MUSIC', 'MAGIC'],
    'N': ['NATURE', 'NOTHING', 'NORMAL', 'NEARBY', 'NOTICE', 'NUMBER', 'NEVER', 'NIGHT', 'NORTH'],
    'O': ['ONLINE', 'OUTSIDE', 'OPENED', 'OBJECT', 'OFFICE', 'ORANGE', 'ORDER', 'OTHER', 'OCEAN'],
    'P': ['PLAYER', 'POINTS', 'PUZZLE', 'PRETTY', 'PLACED', 'PERSON', 'PEACE', 'POWER', 'PIANO'],
    'Q': ['QUALITY', 'QUICKLY', 'QUESTION', 'QUIETLY', 'QUARTER', 'QUEEN', 'QUICK', 'QUITE'],
    'R': ['REALLY', 'RETURN', 'RESULT', 'RECORD', 'REASON', 'RECENT', 'RIGHT', 'ROUND', 'RADIO'],
    'S': ['SIMPLE', 'STRONG', 'SECOND', 'SYSTEM', 'SINGLE', 'SOUNDS', 'SPACE', 'STORY', 'SMART'],
    'T': ['TRYING', 'TURTLE', 'TRAVEL', 'TALENT', 'THANKS', 'TISSUE', 'THINK', 'THREE', 'TIGER'],
    'U': ['UNIQUE', 'UNABLE', 'UNITED', 'USEFUL', 'UPLOAD', 'UNDER', 'UNTIL', 'UPPER', 'URBAN'],
    'V': ['VALLEY', 'VISUAL', 'VOLUME', 'VILLAGE', 'VISION', 'VALUED', 'VOICE', 'VIDEO', 'VALID'],
    'W': ['WINNER', 'WONDER', 'WINDOW', 'WORKED', 'WRITER', 'WEEKLY', 'WORLD', 'WATER', 'WHITE'],
    'X': ['XYLEM', 'XERUS'],
    'Y': ['YELLOW', 'YEARLY', 'YOUNG', 'YOUTH'],
    'Z': ['ZEBRA', 'ZONAL', 'ZONES']
  }
  
  const candidates = wordsByLetter[letter] || []
  return candidates.filter(word => word.length >= minLength && isValidWord(word))
}

function canPlaceWord(
  board: Map<string, PlacedTile>,
  word: string,
  startRow: number,
  startCol: number,
  direction: 'horizontal' | 'vertical',
  tileBag: Tile[]
): boolean {
  // Check if word fits on board
  for (let i = 0; i < word.length; i++) {
    const row = direction === 'vertical' ? startRow + i : startRow
    const col = direction === 'horizontal' ? startCol + i : startCol
    
    if (row < 0 || row >= 15 || col < 0 || col >= 15) {
      return false
    }
  }
  
  // Check if we have required tiles
  const requiredTiles = word.split('')
  const availableTiles = [...tileBag]
  
  for (let i = 0; i < word.length; i++) {
    const row = direction === 'vertical' ? startRow + i : startRow
    const col = direction === 'horizontal' ? startCol + i : startCol
    const existing = board.get(`${row},${col}`)
    
    if (existing) {
      if (existing.letter !== word[i]) {
        return false
      }
    } else {
      // Need this tile from bag
      const tileIndex = availableTiles.findIndex(t => t.letter === word[i])
      if (tileIndex === -1) {
        return false
      }
      availableTiles.splice(tileIndex, 1)
    }
  }
  
  return true
}

function placeWord(
  board: Map<string, PlacedTile>,
  word: string,
  startRow: number,
  startCol: number,
  direction: 'horizontal' | 'vertical',
  tileBag: Tile[]
): boolean {
  if (!canPlaceWord(board, word, startRow, startCol, direction, tileBag)) {
    return false
  }
  
  // Place the word
  for (let i = 0; i < word.length; i++) {
    const row = direction === 'vertical' ? startRow + i : startRow
    const col = direction === 'horizontal' ? startCol + i : startCol
    const key = `${row},${col}`
    
    if (!board.has(key)) {
      const tileIndex = tileBag.findIndex(t => t.letter === word[i])
      if (tileIndex >= 0) {
        const tile = tileBag.splice(tileIndex, 1)[0]
        board.set(key, {
          ...tile,
          row,
          col
        })
      }
    }
  }
  
  return true
}

export class ProgressivePuzzleBuilder {
  private board: Map<string, PlacedTile> = new Map()
  private tileBag: Tile[]
  private wordsGenerated: string[] = []
  private rack: Tile[] = []
  private isValidWord: (word: string) => boolean
  private isDictionaryLoaded: boolean
  
  constructor(isValidWord: (word: string) => boolean, isDictionaryLoaded: boolean) {
    this.isValidWord = isValidWord
    this.isDictionaryLoaded = isDictionaryLoaded
    this.tileBag = shuffleArray([...TILE_DISTRIBUTION])
    
    // Create player rack immediately
    this.rack = this.tileBag.splice(0, 7)
  }
  
  async placeInitialWord(): Promise<PuzzleConstructionStep> {
    const word = getRandomLongWord(this.isValidWord)
    if (!word) {
      throw new Error('Cannot find valid initial word')
    }
    
    const startCol = 7 - Math.floor(word.length / 2)
    const success = placeWord(this.board, word, 7, startCol, 'horizontal', this.tileBag)
    
    if (!success) {
      throw new Error('Failed to place initial word')
    }
    
    this.wordsGenerated.push(word)
    
    return {
      type: 'INITIAL_WORD',
      wordAdded: word,
      position: { row: 7, col: startCol },
      direction: 'horizontal'
    }
  }
  
  async addConnectedWord(stepNumber: number): Promise<PuzzleConstructionStep> {
    const placedTiles = Array.from(this.board.values())
    if (placedTiles.length === 0) {
      throw new Error('No tiles on board to connect to')
    }
    
    // Try multiple times to find a valid connection
    for (let attempt = 0; attempt < 50; attempt++) {
      const randomTile = placedTiles[Math.floor(Math.random() * placedTiles.length)]
      const connectingLetter = randomTile.letter
      
      const possibleWords = findWordsStartingWith(connectingLetter, this.isValidWord, 3)
      if (possibleWords.length === 0) continue
      
      const word = possibleWords[Math.floor(Math.random() * possibleWords.length)]
      const direction = Math.random() < 0.5 ? 'horizontal' : 'vertical'
      
      // Try to place the word connecting at the randomTile position
      let startRow = randomTile.row
      let startCol = randomTile.col
      
      if (direction === 'horizontal') {
        // Word goes horizontally, connecting letter could be anywhere in the word
        const letterIndexInWord = word.indexOf(connectingLetter)
        if (letterIndexInWord >= 0) {
          startCol = randomTile.col - letterIndexInWord
        }
      } else {
        // Word goes vertically
        const letterIndexInWord = word.indexOf(connectingLetter)
        if (letterIndexInWord >= 0) {
          startRow = randomTile.row - letterIndexInWord
        }
      }
      
      if (canPlaceWord(this.board, word, startRow, startCol, direction, this.tileBag)) {
        const success = placeWord(this.board, word, startRow, startCol, direction, this.tileBag)
        if (success) {
          this.wordsGenerated.push(word)
          
          return {
            type: 'CONNECTED_WORD',
            wordAdded: word,
            position: { row: startRow, col: startCol },
            direction,
            stepNumber,
            totalSteps: 6
          }
        }
      }
    }
    
    throw new Error(`Failed to add connected word at step ${stepNumber}`)
  }
  
  async findBestPlayerMove(): Promise<PuzzleConstructionStep> {
    const bot = new ScrabbleBot(this.isValidWord, this.isDictionaryLoaded)
    const gameState = {
      board: this.board,
      players: [],
      currentPlayerIndex: 0,
      tileBag: [],
      gameStatus: 'playing' as const
    }
    
    const allMoves = bot.generateAllPossibleMoves(gameState, this.rack)
    const bestMoves = allMoves
      .filter(move => move.score >= 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    
    if (bestMoves.length === 0) {
      throw new Error('No valid moves found for player rack')
    }
    
    return {
      type: 'FINDING_BEST_MOVE'
    }
  }
  
  getCurrentState(): ProgressivePuzzleState {
    return {
      board: new Map(this.board),
      rack: [...this.rack],
      wordsGenerated: [...this.wordsGenerated],
      currentStep: { type: 'INITIAL_WORD' },
      isComplete: false
    }
  }
  
  async buildCompletePuzzle(): Promise<Puzzle> {
    const bot = new ScrabbleBot(this.isValidWord, this.isDictionaryLoaded)
    const gameState = {
      board: this.board,
      players: [],
      currentPlayerIndex: 0,
      tileBag: [],
      gameStatus: 'playing' as const
    }
    
    const allMoves = bot.generateAllPossibleMoves(gameState, this.rack)
    const topMoves = allMoves
      .filter(move => move.score >= 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(move => {
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
      id: `progressive-puzzle-${Date.now()}`,
      board: Array.from(this.board.values()),
      rack: shuffleArray([...this.rack]),
      topMoves
    }
  }
}