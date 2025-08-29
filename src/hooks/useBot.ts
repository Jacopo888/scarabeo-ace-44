import { useState, useCallback, useMemo } from 'react'
import { Difficulty } from '@/components/DifficultyModal'
import { GameState, Tile } from '@/types/game'
import { useDictionary } from '@/contexts/DictionaryContext'
import { BotMovePicker } from '@/ai/BotMovePicker'
import { BotMove } from '@/ai/ScrabbleBot'

export const useBot = () => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const { isValidWord, isLoaded: isDictionaryLoaded } = useDictionary()

  // Create bot instance with memoization for performance
  const botMovePicker = useMemo(
    () => new BotMovePicker(isValidWord, isDictionaryLoaded),
    [isValidWord, isDictionaryLoaded]
  )

  // Update bot when dictionary changes
  const generateAllPossibleMoves = useCallback((
    gameState: GameState,
    playerRack: Tile[]
  ): BotMove[] => {
    botMovePicker.updateDictionary(isValidWord, isDictionaryLoaded)
    return botMovePicker.bot.generateAllPossibleMoves(gameState, playerRack)
  }, [botMovePicker, isValidWord, isDictionaryLoaded])

  const selectBestMove = useCallback((moves: BotMove[], difficulty: Difficulty): BotMove | null => {
    return botMovePicker.bot.selectBestMove(moves, difficulty)
  }, [botMovePicker])

  const makeBotMove = useCallback(async (
    gameState: GameState,
    playerRack: Tile[]
  ): Promise<BotMove | null> => {
    if (!difficulty) return null
    
    setIsBotThinking(true)
    try {
      botMovePicker.updateDictionary(isValidWord, isDictionaryLoaded)
      const move = await botMovePicker.generateMove(gameState, playerRack, difficulty)
      return move
    } finally {
      setIsBotThinking(false)
    }
  }, [botMovePicker, difficulty, isValidWord, isDictionaryLoaded])

  return {
    difficulty,
    setDifficulty,
    makeBotMove,
    isBotThinking,
    generateAllPossibleMoves,
    selectBestMove,
    isDictionaryLoaded,
    canMakeMove: useCallback((gameState: GameState, playerRack: Tile[]) => {
      botMovePicker.updateDictionary(isValidWord, isDictionaryLoaded)
      return botMovePicker.canMakeMove(gameState, playerRack)
    }, [botMovePicker, isValidWord, isDictionaryLoaded])
  }
}