import { GameState, Tile, PlacedTile, TILE_DISTRIBUTION } from '@/types/game'
import { Puzzle, PuzzleMove } from '@/types/puzzle'
import { ScrabbleBot, BotMove } from '@/ai/ScrabbleBot'


export interface BotPuzzleProgress {
  currentStep: number
  totalSteps: number
  currentAction: string
}

export class BotBasedPuzzleBuilder {
  private bot: ScrabbleBot
  private tileBag: Tile[] = []
  private gameState: GameState
  private userRack: Tile[]
  private onProgress?: (progress: BotPuzzleProgress) => void

  constructor(
    isValidWord: (word: string) => boolean,
    isDictionaryLoaded: boolean,
    userRack: Tile[],
    onProgress?: (progress: BotPuzzleProgress) => void
  ) {
    this.bot = new ScrabbleBot(isValidWord, isDictionaryLoaded)
    this.userRack = [...userRack]
    this.gameState = this.createInitialGameState()
    this.onProgress = onProgress
    this.initializeTileBag()
  }

  private createInitialGameState(): GameState {
    return {
      board: new Map<string, PlacedTile>(),
      players: [
        { id: 'user', name: 'User', score: 0, rack: this.userRack },
        { id: 'bot', name: 'Bot', score: 0, rack: [] }
      ],
      currentPlayerIndex: 0,
      tileBag: [...TILE_DISTRIBUTION],
      gameStatus: 'playing'
    }
  }

  private initializeTileBag() {
    // Create tile bag from distribution, excluding user's tiles
    const userLetters = this.userRack.map(t => t.letter)
    this.tileBag = [...TILE_DISTRIBUTION]
    
    // Remove user's tiles from the bag
    for (const userTile of this.userRack) {
      const index = this.tileBag.findIndex(t => 
        t.letter === userTile.letter && t.isBlank === userTile.isBlank
      )
      if (index !== -1) {
        this.tileBag.splice(index, 1)
      }
    }
    
    // Shuffle the bag
    this.shuffleTileBag()
  }

  private shuffleTileBag() {
    for (let i = this.tileBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.tileBag[i], this.tileBag[j]] = [this.tileBag[j], this.tileBag[i]]
    }
  }

  private drawRandomRack(): Tile[] {
    const rackSize = Math.min(7, this.tileBag.length)
    const rack = this.tileBag.splice(0, rackSize)
    return rack
  }

  private getRandomStartWord(): { word: string, startCol: number } {
    const startWords = [
      'PLAYING', 'LETTERS', 'POINTS', 'DOUBLE', 'TRIPLE', 'MASTER',
      'EXPERT', 'PUZZLE', 'STRATEGY', 'QUALITY', 'STATION', 'NETWORK',
      'SYSTEMS', 'MODERN', 'PERFECT', 'PICTURE', 'KITCHEN', 'GARDEN',
      'BRIDGE', 'FRIEND', 'SIMPLE', 'GOLDEN', 'SILVER', 'PURPLE'
    ]
    
    const word = startWords[Math.floor(Math.random() * startWords.length)]
    const startCol = Math.floor((15 - word.length) / 2)
    
    return { word, startCol }
  }

  private placeInitialWord(): boolean {
    const { word, startCol } = this.getRandomStartWord()
    
    console.log(`Placing initial word: ${word} at (7, ${startCol})`)
    
    try {
      for (let i = 0; i < word.length; i++) {
        const tile: PlacedTile = {
          letter: word[i],
          points: this.getLetterPoints(word[i]),
          row: 7,
          col: startCol + i,
          isBlank: false
        }
        
        const key = `${tile.row}-${tile.col}`
        this.gameState.board.set(key, tile)
      }
      
      console.log(`Initial word "${word}" placed successfully`)
      return true
    } catch (error) {
      console.error('Failed to place initial word:', error)
      return false
    }
  }

  private getLetterPoints(letter: string): number {
    const tileInfo = TILE_DISTRIBUTION.find(t => t.letter === letter)
    return tileInfo ? tileInfo.points : 1
  }

  private reportProgress(step: number, action: string) {
    if (this.onProgress) {
      this.onProgress({
        currentStep: step,
        totalSteps: 8, // 1 initial + 7 bot moves
        currentAction: action
      })
    }
  }

  async buildPuzzle(): Promise<Puzzle | null> {
    try {
      // Step 1: Place initial word
      this.reportProgress(1, 'Placing initial word...')
      if (!this.placeInitialWord()) {
        throw new Error('Failed to place initial word')
      }
      
      // Step 2-8: Bot places 7 words
      for (let i = 0; i < 7; i++) {
        this.reportProgress(i + 2, `Bot placing word ${i + 1}/7...`)
        
        const botRack = this.drawRandomRack()
        console.log(`Bot move ${i + 1} with rack:`, botRack.map(t => t.letter))
        
        // Generate bot move with medium difficulty
        const allMoves = this.bot.generateAllPossibleMoves(this.gameState, botRack)
        const botMove = this.bot.selectBestMove(allMoves, 'medium')
        
        if (!botMove) {
          console.log(`Bot couldn't find move ${i + 1}, continuing...`)
          continue
        }
        
        // Apply bot move to game state
        for (const tile of botMove.tiles) {
          const key = `${tile.row}-${tile.col}`
          this.gameState.board.set(key, tile)
        }
        console.log(`Bot placed word: ${botMove.words.join(', ')} for ${botMove.score} points`)
        
        // Small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // Step 9: Find best user move with hard difficulty
      this.reportProgress(8, 'Finding best move for puzzle...')
      const userMoves = this.bot.generateAllPossibleMoves(this.gameState, this.userRack)
      const bestUserMove = this.bot.selectBestMove(userMoves, 'hard')
      
      if (!bestUserMove) {
        throw new Error('Could not find valid move for user rack')
      }
      
      // Create top moves (just the best one for now)
      const topMoves: PuzzleMove[] = [{
        tiles: bestUserMove.tiles,
        words: bestUserMove.words,
        score: bestUserMove.score,
        startCell: bestUserMove.tiles.length > 0 ? {
          row: bestUserMove.tiles[0].row,
          col: bestUserMove.tiles[0].col
        } : undefined,
        mainWordLength: bestUserMove.words.length > 0 ? bestUserMove.words[0].length : undefined,
        lettersUsed: bestUserMove.tiles.map(t => t.letter)
      }]
      
      // Convert board Map to array for puzzle
      const boardTiles = Array.from(this.gameState.board.values())
      
      // Create final puzzle
      const puzzle: Puzzle = {
        id: `bot-puzzle-${Date.now()}`,
        board: boardTiles,
        rack: this.userRack,
        topMoves: topMoves
      }
      
      console.log('Bot-based puzzle generation completed successfully!')
      console.log(`Final board has ${puzzle.board.length} tiles`)
      console.log(`Best user move: ${bestUserMove.words.join(', ')} for ${bestUserMove.score} points`)
      
      return puzzle
      
    } catch (error) {
      console.error('Error in bot-based puzzle generation:', error)
      return null
    }
  }
}