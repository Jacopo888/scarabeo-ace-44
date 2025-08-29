import useSWR from 'swr'
import { fetchPuzzle, fetchPuzzleLeaderboard, PuzzleResponse, PuzzleLeaderboardEntry } from '@/api/puzzle'

export function usePuzzlePuzzle() {
  return useSWR<PuzzleResponse>('/api/puzzle/new', fetchPuzzle, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })
}

export function usePuzzleLeaderboard(refreshMs = 15000) {
  return useSWR<PuzzleLeaderboardEntry[]>('/api/puzzle/leaderboard', () => fetchPuzzleLeaderboard(50), {
    refreshInterval: refreshMs,
    revalidateOnFocus: false,
  })
}