import type { GameRecord } from '@/types/multiplayer'

const GAME_PARTICIPANT_COLUMNS = ['player1_id', 'player2_id'] as const

export function gameParticipantFilters(userId: string): string[] {
  return GAME_PARTICIPANT_COLUMNS.map((column) => `${column}=eq.${userId}`)
}

export function isGameForUser(
  game: Pick<GameRecord, 'player1_id' | 'player2_id'>,
  userId: string
): boolean {
  return game.player1_id === userId || game.player2_id === userId
}
