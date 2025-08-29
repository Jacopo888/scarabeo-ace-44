import { GameState, Tile, PlacedTile, TILE_DISTRIBUTION } from '@/types/game'
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
    'CROSSWORD', 'SPELLING', 'VOCABULARY', 'DICTIONARY', 'COMPUTER', 'SENTENCE',
    'QUALITY', 'STATION', 'NETWORK', 'SYSTEMS', 'MODERN', 'PERFECT', 'CAREFUL',
    'PICTURE', 'KITCHEN', 'GARDEN', 'BRIDGE', 'FRIEND', 'SIMPLE', 'GOLDEN',
    'SILVER', 'PURPLE', 'ORANGE', 'YELLOW', 'FAMOUS', 'STRONG', 'BRIGHT'
  ]
  
  console.log('Looking for valid long words...')
  const validWords = longWords.filter(word => {
    const isValid = word.length >= 6 && isValidWord(word)
    console.log(`Word "${word}": ${isValid ? 'VALID' : 'INVALID'}`)
    return isValid
  })
  
  console.log(`Found ${validWords.length} valid words:`, validWords)
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

function findIntersectingWords(
  board: Map<string, PlacedTile>,
  word: string,
  startRow: number,
  startCol: number,
  direction: 'horizontal' | 'vertical'
): string[] {
  const intersectingWords: string[] = []
  
  for (let i = 0; i < word.length; i++) {
    const row = direction === 'vertical' ? startRow + i : startRow
    const col = direction === 'horizontal' ? startCol + i : startCol
    
    // Check perpendicular direction for words formed
    if (direction === 'horizontal') {
      // Check vertical words formed by this letter
      let verticalWord = ''
      let startVertRow = row
      
      // Find start of vertical word
      while (startVertRow > 0 && board.has(`${startVertRow - 1},${col}`)) {
        startVertRow--
      }
      
      // Build vertical word
      let currentRow = startVertRow
      while (currentRow < 15) {
        const key = `${currentRow},${col}`
        if (board.has(key)) {
          verticalWord += board.get(key)!.letter
        } else if (currentRow === row) {
          verticalWord += word[i]
        } else {
          break
        }
        currentRow++
      }
      
      if (verticalWord.length > 1) {
        intersectingWords.push(verticalWord)
      }
    } else {
      // Check horizontal words formed by this letter
      let horizontalWord = ''
      let startHorCol = col
      
      // Find start of horizontal word
      while (startHorCol > 0 && board.has(`${row},${startHorCol - 1}`)) {
        startHorCol--
      }
      
      // Build horizontal word
      let currentCol = startHorCol
      while (currentCol < 15) {
        const key = `${row},${currentCol}`
        if (board.has(key)) {
          horizontalWord += board.get(key)!.letter
        } else if (currentCol === col) {
          horizontalWord += word[i]
        } else {
          break
        }
        currentCol++
      }
      
      if (horizontalWord.length > 1) {
        intersectingWords.push(horizontalWord)
      }
    }
  }
  
  return intersectingWords
}

function canPlaceWord(
  board: Map<string, PlacedTile>,
  word: string,
  startRow: number,
  startCol: number,
  direction: 'horizontal' | 'vertical',
  tileBag: Tile[],
  isValidWord: (word: string) => boolean
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
  
  // Check that all intersecting words are valid
  const intersectingWords = findIntersectingWords(board, word, startRow, startCol, direction)
  for (const intersectingWord of intersectingWords) {
    if (!isValidWord(intersectingWord)) {
      console.log(`Invalid intersecting word: "${intersectingWord}"`)
      return false
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
  tileBag: Tile[],
  isValidWord: (word: string) => boolean
): boolean {
  if (!canPlaceWord(board, word, startRow, startCol, direction, tileBag, isValidWord)) {
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
  private bestMove?: PuzzleMove
  
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
    const success = placeWord(this.board, word, 7, startCol, 'horizontal', this.tileBag, this.isValidWord)
    
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
      
      if (canPlaceWord(this.board, word, startRow, startCol, direction, this.tileBag, this.isValidWord)) {
        const success = placeWord(this.board, word, startRow, startCol, direction, this.tileBag, this.isValidWord)
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
    console.log('Finding best player move with rack:', this.rack.map(t => t.letter))

    if (!this.isDictionaryLoaded) {
      this.bestMove = undefined
      return { type: 'FINDING_BEST_MOVE' }
    }

    const bot = new ScrabbleBot(this.isValidWord, this.isDictionaryLoaded)
    const gameState: GameState = {
      board: this.board,
      players: [],
      currentPlayerIndex: 0,
      tileBag: [],
      gameStatus: 'playing'
    }

    const moves = bot.generateAllPossibleMoves(gameState, this.rack)
    const best = bot.selectBestMove(moves, 'hard')

    if (best) {
      const isHorizontal = best.tiles.every(t => t.row === best.tiles[0].row)
      const startTile = isHorizontal
        ? best.tiles.reduce((min, t) => (t.col < min.col ? t : min), best.tiles[0])
        : best.tiles.reduce((min, t) => (t.row < min.row ? t : min), best.tiles[0])

      this.bestMove = {
        tiles: best.tiles.map(t => ({ ...t, isPlaced: false })),
        words: best.words,
        score: best.score,
        startCell: { row: startTile.row, col: startTile.col },
        mainWordLength: best.words.length > 0 ? Math.max(...best.words.map(w => w.length)) : undefined,
        lettersUsed: best.tiles.map(t => t.letter).sort()
      }
    } else {
      this.bestMove = undefined
    }

    return { type: 'FINDING_BEST_MOVE' }
  }

  getCurrentState(): ProgressivePuzzleState {
    return {
      board: new Map(this.board),
      rack: [...this.rack],
      wordsGenerated: [...this.wordsGenerated],
      currentStep: { type: 'INITIAL_WORD' },
      isComplete: false,
      bestMove: this.bestMove
    }
  }
  
  async buildCompletePuzzle(): Promise<Puzzle> {
    console.log('Building complete puzzle with board size:', this.board.size)

    if (!this.bestMove) {
      await this.findBestPlayerMove()
    }

    let topMoves: PuzzleMove[]

    if (this.bestMove) {
      topMoves = [this.bestMove]
    } else {
      // Fallback simple move if bot fails
      topMoves = [{
        tiles: this.rack.slice(0, 3).map((tile, i) => ({
          ...tile,
          row: 8,
          col: 7 + i,
          isPlaced: false
        })),
        words: ['SAMPLE'],
        score: 25,
        startCell: { row: 8, col: 7 },
        mainWordLength: 6,
        lettersUsed: this.rack.slice(0, 3).map(t => t.letter).sort()
      }]
    }

    return {
      id: `progressive-puzzle-${Date.now()}`,
      board: Array.from(this.board.values()),
      rack: shuffleArray([...this.rack]),
      topMoves
    }
  }
}