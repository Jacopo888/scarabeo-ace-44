import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { postAnalysis, type AnalysisRequest, type AnalysisResponse } from '@/api/analysis'

export interface GameMove {
  move_index: number
  word: string | null
  score_earned: number
  rack_before: any[]
  player_id: string
  row?: number
  col?: number
  dir?: 'H' | 'V'
}

export const useGameAnalysis = (gameId: string | null, initialMoves: GameMove[] = []) => {
  const [moves, setMoves] = useState<GameMove[]>(initialMoves)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch moves for the game
  const fetchMoves = async () => {
    if (!gameId) return

    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('moves')
        .select('move_index, word, score_earned, rack_before, player_id, tiles_placed')
        .eq('game_id', gameId)
        .eq('move_type', 'place') // Only analyze actual word plays
        .order('move_index')

      if (fetchError) throw fetchError

      const formattedMoves = data?.map(move => ({
        move_index: move.move_index,
        word: move.word || '',
        score_earned: move.score_earned,
        rack_before: Array.isArray(move.rack_before) ? move.rack_before : [],
        player_id: move.player_id,
        // Extract position from tiles_placed if available
        row: move.tiles_placed?.[0]?.row || 7,
        col: move.tiles_placed?.[0]?.col || 7,
        dir: 'H' as const // Simplified for now
      })) || []

      setMoves(formattedMoves)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch moves')
    } finally {
      setLoading(false)
    }
  }

  // Analyze the moves using the API
  const analyzeGame = async () => {
    if (moves.length === 0) return

    try {
      setLoading(true)
      setError(null)
      
      // Convert moves to analysis format
      const analysisRequest: AnalysisRequest = {
        moves: moves.map(move => ({
          row: move.row || 7,
          col: move.col || 7,
          dir: move.dir || 'H',
          word: move.word || '',
          score: move.score_earned,
          rackBefore: move.rack_before.map(tile => tile.letter || '').join('')
        })),
        boardSize: 15,
        lexicon: 'NWL'
      }

      const analysisResult = await postAnalysis(analysisRequest)
      setAnalysis(analysisResult)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      console.error('Game analysis error:', err)
      
      if (errorMessage.includes('not available in this environment')) {
        setError('Game analysis is not available in preview mode')
      } else if (errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
        setError('Unable to connect to analysis service. Please try again later.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialMoves.length > 0) {
      setMoves(initialMoves)
    } else if (gameId) {
      fetchMoves()
    }
  }, [gameId, initialMoves])

  return {
    moves,
    analysis,
    loading,
    error,
    fetchMoves,
    analyzeGame
  }
}