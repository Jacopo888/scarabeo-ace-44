import { GameState, Tile } from '@/types/game'
import { ScrabbleBot, BotMove } from './ScrabbleBot'
import { Difficulty } from '@/components/DifficultyModal'

export class BotMovePicker {
  public bot: ScrabbleBot

  constructor(isValidWordFn: (word: string) => boolean, isDictionaryLoaded: boolean) {
    this.bot = new ScrabbleBot(isValidWordFn, isDictionaryLoaded)
  }

  updateDictionary(isValidWordFn: (word: string) => boolean, isDictionaryLoaded: boolean) {
    this.bot.updateDictionary(isValidWordFn, isDictionaryLoaded)
  }

  async generateMove(
    gameState: GameState, 
    playerRack: Tile[], 
    difficulty: Difficulty
  ): Promise<BotMove | null> {
    // Simulate thinking time for better UX
    const thinkingTime = this.getThinkingTime(difficulty)
    await new Promise(resolve => setTimeout(resolve, thinkingTime))

    // Generate all possible moves
    const allMoves = this.bot.generateAllPossibleMoves(gameState, playerRack)
    
    if (allMoves.length === 0) {
      return null // Bot will pass or exchange tiles
    }

    // Select best move using Top-K + Soft-Max
    return this.bot.selectBestMove(allMoves, difficulty)
  }

  canMakeMove(gameState: GameState, playerRack: Tile[]): boolean {
    const moves = this.bot.generateAllPossibleMoves(gameState, playerRack)
    return moves.length > 0
  }

  private getThinkingTime(difficulty: Difficulty): number {
    switch (difficulty) {
      case 'easy': return 800 + Math.random() * 1200   // 0.8-2.0s
      case 'medium': return 1200 + Math.random() * 1800 // 1.2-3.0s  
      case 'hard': return 1500 + Math.random() * 2500   // 1.5-4.0s
      default: return 1000
    }
  }
}