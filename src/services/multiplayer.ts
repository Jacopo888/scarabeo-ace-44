import { supabase } from '@/integrations/supabase/client'
import { GameRecord } from '@/types/multiplayer'
import { PlacedTile, Tile } from '@/types/game'
import { shuffleArray, drawTiles } from '@/lib/multiplayer/tiles'
import { shouldEndGameAfterMove, applyEndgamePenalties } from '@/lib/multiplayer/endgame'

export async function fetchGameWithProfiles(gameId: string) {
  const { data, error } = await supabase
    .from('games')
    .select(`
      *,
      player1:profiles!games_player1_id_fkey(username, display_name),
      player2:profiles!games_player2_id_fkey(username, display_name)
    `)
    .eq('id', gameId)
    .single()

  if (error) throw error
  return data as unknown as GameRecord
}

export async function updateGameRecord(
  gameId: string,
  update: Partial<GameRecord>
) {
  const { error } = await supabase
    .from('games')
    .update(update as any)
    .eq('id', gameId)
  if (error) throw error
}

type MoveLogBase = {
  move_type: 'place_tiles' | 'exchange_tiles' | 'pass' | 'resign'
  score_earned?: number
}

export async function logMove(
  gameId: string,
  playerId: string,
  entry: (
    | (MoveLogBase & {
        move_type: 'place_tiles'
        tiles_placed?: PlacedTile[]
        words_formed?: string[]
        board_state_after?: Record<string, PlacedTile>
        rack_after?: Tile[]
      })
    | (MoveLogBase & {
        move_type: 'exchange_tiles'
        tiles_exchanged?: Tile[]
        board_state_after?: Record<string, PlacedTile>
        rack_after?: Tile[]
      })
    | (MoveLogBase & { move_type: 'pass' | 'resign'; board_state_after?: Record<string, PlacedTile>; rack_after?: Tile[] })
  )
) {
  const { error } = await supabase
    .from('moves')
    .insert({
      game_id: gameId,
      player_id: playerId,
      ...entry,
    } as any)
  if (error) throw error
}

export async function submitMoveForGame(params: {
  game: GameRecord
  userId: string
  pendingTiles: PlacedTile[]
  newBoardState: Record<string, PlacedTile>
  moveScore: number
  words: string[]
}) {
  const { game, userId, pendingTiles, newBoardState, moveScore, words } = params
  const isPlayer1 = game.player1_id === userId
  const currentRack = [...(isPlayer1 ? game.player1_rack : game.player2_rack)] as Tile[]
  let newRack = [...currentRack]

  // Remove used tiles from rack (preserving duplicates/blanks)
  pendingTiles.forEach(placedTile => {
    const tileIndex = newRack.findIndex(rackTile => {
      if (placedTile.isBlank && rackTile.isBlank) return true
      return (
        rackTile.letter === placedTile.letter &&
        rackTile.points === placedTile.points &&
        rackTile.isBlank === placedTile.isBlank
      )
    })
    if (tileIndex !== -1) newRack.splice(tileIndex, 1)
  })

  // Draw to refill rack
  const tilesNeeded = 7 - newRack.length
  const { drawn, remaining } =
    tilesNeeded > 0 && game.tile_bag.length > 0
      ? drawTiles(game.tile_bag, Math.min(tilesNeeded, game.tile_bag.length))
      : { drawn: [] as Tile[], remaining: game.tile_bag }
  newRack = [...newRack, ...drawn]

  // Next player
  const nextPlayerId = game.current_player_id === game.player1_id ? game.player2_id : game.player1_id

  // Prepare update
  const gameUpdate: Partial<GameRecord> = {
    board_state: newBoardState,
    tile_bag: remaining,
    current_player_id: nextPlayerId,
    pass_count: 0,
    updated_at: new Date().toISOString(),
  }

  const player1RackAfter = isPlayer1 ? newRack : game.player1_rack
  const player2RackAfter = isPlayer1 ? game.player2_rack : newRack

  let player1ScoreAfter = game.player1_score
  let player2ScoreAfter = game.player2_score

  if (isPlayer1) {
    player1ScoreAfter += moveScore
    gameUpdate.player1_rack = newRack
  } else {
    player2ScoreAfter += moveScore
    gameUpdate.player2_rack = newRack
  }

  const endGame = shouldEndGameAfterMove(player1RackAfter, player2RackAfter, remaining)
  if (endGame) {
    const { p1, p2 } = applyEndgamePenalties(
      player1ScoreAfter,
      player2ScoreAfter,
      player1RackAfter,
      player2RackAfter
    )
    player1ScoreAfter = p1
    player2ScoreAfter = p2
    gameUpdate.status = 'completed'
    gameUpdate.winner_id =
      player1ScoreAfter > player2ScoreAfter
        ? game.player1_id
        : player2ScoreAfter > player1ScoreAfter
        ? game.player2_id
        : null
  }

  gameUpdate.player1_score = player1ScoreAfter
  gameUpdate.player2_score = player2ScoreAfter

  await updateGameRecord(game.id, gameUpdate)

  await logMove(game.id, userId, {
    move_type: 'place_tiles',
    tiles_placed: pendingTiles,
    words_formed: words,
    score_earned: moveScore,
    board_state_after: newBoardState,
    rack_after: newRack,
  })

  return { endGame, winnerId: endGame ? (gameUpdate.winner_id ?? null) : undefined }
}

export async function exchangeTilesForGame(params: {
  game: GameRecord
  userId: string
  indexes: number[]
}) {
  const { game, userId, indexes } = params
  const isPlayer1 = game.player1_id === userId
  const rack = isPlayer1 ? [...game.player1_rack] : [...game.player2_rack]
  const tilesToReturn: Tile[] = []

  const sorted = [...indexes].sort((a, b) => b - a)
  sorted.forEach(i => {
    const t = rack[i]
    if (t) {
      tilesToReturn.push(t)
      rack.splice(i, 1)
    }
  })

  const bagWithReturned = shuffleArray([...game.tile_bag, ...tilesToReturn])
  const { drawn, remaining } = drawTiles(bagWithReturned, indexes.length)
  const newRack = [...rack, ...drawn]

  const nextPlayerId = game.current_player_id === game.player1_id ? game.player2_id : game.player1_id

  const gameUpdate: Partial<GameRecord> = {
    tile_bag: remaining,
    current_player_id: nextPlayerId,
    pass_count: 0,
    updated_at: new Date().toISOString(),
  }
  if (isPlayer1) gameUpdate.player1_rack = newRack
  else gameUpdate.player2_rack = newRack

  await updateGameRecord(game.id, gameUpdate)

  await logMove(game.id, userId, {
    move_type: 'exchange_tiles',
    tiles_exchanged: tilesToReturn,
    score_earned: 0,
    board_state_after: game.board_state,
    rack_after: newRack,
  })
}

export async function passTurnForGame(params: {
  game: GameRecord
  userId: string
}) {
  const { game, userId } = params
  const nextPlayerId = game.current_player_id === game.player1_id ? game.player2_id : game.player1_id
  const newPassCount = (game.pass_count || 0) + 1

  const gameUpdate: Partial<GameRecord> = {
    current_player_id: nextPlayerId,
    pass_count: newPassCount,
    updated_at: new Date().toISOString(),
  }

  let player1ScoreAfter = game.player1_score
  let player2ScoreAfter = game.player2_score

  const endOnPasses = newPassCount >= 4
  const endGame = endOnPasses || shouldEndGameAfterMove(
    game.player1_rack,
    game.player2_rack,
    game.tile_bag
  )

  if (endGame) {
    const { p1, p2 } = applyEndgamePenalties(
      player1ScoreAfter,
      player2ScoreAfter,
      game.player1_rack,
      game.player2_rack
    )
    player1ScoreAfter = p1
    player2ScoreAfter = p2
    gameUpdate.status = 'completed'
    gameUpdate.winner_id =
      player1ScoreAfter > player2ScoreAfter
        ? game.player1_id
        : player2ScoreAfter > player1ScoreAfter
        ? game.player2_id
        : null
    gameUpdate.player1_score = player1ScoreAfter
    gameUpdate.player2_score = player2ScoreAfter
  }

  await updateGameRecord(game.id, gameUpdate)

  await logMove(game.id, userId, {
    move_type: 'pass',
    score_earned: 0,
    board_state_after: game.board_state,
    rack_after: (game.player1_id === userId ? game.player1_rack : game.player2_rack),
  })

  return { endGame, winnerId: endGame ? (gameUpdate.winner_id ?? null) : undefined }
}

export async function surrenderGameForGame(params: {
  game: GameRecord
  userId: string
}) {
  const { game, userId } = params
  const opponentId = game.player1_id === userId ? game.player2_id : game.player1_id

  const gameUpdate: Partial<GameRecord> = {
    status: 'completed',
    winner_id: opponentId,
    updated_at: new Date().toISOString(),
  }

  await updateGameRecord(game.id, gameUpdate)

  await logMove(game.id, userId, {
    move_type: 'resign',
    score_earned: 0,
    board_state_after: game.board_state,
    rack_after: (game.player1_id === userId ? game.player1_rack : game.player2_rack),
  })

  return { winnerId: opponentId }
}

