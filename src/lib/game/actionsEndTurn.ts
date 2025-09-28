import type { GameState, Player } from '@/types/game'
import { drawTiles } from './random'
import { canEndGame } from '@/utils/gameRules'
import { computeFinalPlayers } from './endgame'

export function applyEndTurn(prev: GameState): GameState {
  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const tilesNeeded = 7 - currentPlayer.rack.length

  const { drawn, remaining } =
    tilesNeeded > 0 && prev.tileBag.length > 0
      ? drawTiles(prev.tileBag, Math.min(tilesNeeded, prev.tileBag.length))
      : { drawn: [], remaining: prev.tileBag }

  const newPlayers = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    rack: [...currentPlayer.rack, ...drawn]
  }

  const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
  newPassCounts[prev.currentPlayerIndex] = 0

  const endGame = canEndGame(
    newPlayers.map(p => ({ rack: p.rack })),
    remaining
  )

  if (endGame) {
    const finalPlayers: Player[] = computeFinalPlayers(newPlayers)
    return {
      ...prev,
      players: finalPlayers,
      tileBag: remaining,
      gameStatus: 'finished',
      passCounts: newPassCounts
    }
  }

  return {
    ...prev,
    players: newPlayers,
    tileBag: remaining,
    currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
    passCounts: newPassCounts
  }
}
