import type { GameState, Player } from '@/types/game'
import { canEndGame } from '@/utils/gameRules'
import { computeFinalPlayers } from './endgame'

// Applies a pass turn: increments current player's pass count, checks endgame, and either finishes or passes turn.
export function applyPassTurn(prev: GameState): GameState {
  const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
  newPassCounts[prev.currentPlayerIndex] += 1

  const bothPassedTwice = newPassCounts.every(c => c >= 2)
  const endGame = bothPassedTwice || canEndGame(
    prev.players.map(p => ({ rack: p.rack })),
    prev.tileBag,
    0
  )

  if (endGame) {
    const finalPlayers: Player[] = computeFinalPlayers(prev.players)
    return {
      ...prev,
      players: finalPlayers,
      gameStatus: 'finished',
      passCounts: newPassCounts
    }
  }

  return {
    ...prev,
    currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
    passCounts: newPassCounts
  }
}
