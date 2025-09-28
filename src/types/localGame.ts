// Shared lightweight move history entry for local/quackle games
export type GameMoveLite = {
  move_index: number
  word: string | null
  score_earned: number
  rack_before: any[]
  player_id: string
  row?: number
  col?: number
  dir?: 'H' | 'V'
}
