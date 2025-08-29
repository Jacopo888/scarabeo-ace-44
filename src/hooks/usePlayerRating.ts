import useSWR from 'swr'

const API_BASE = import.meta.env.VITE_RATING_API_URL || (import.meta.env.MODE === 'development' ? '/api' : '')
const fetcher = (url: string) => fetch(url).then(res => res.json())

export const usePlayerRating = (playerId?: number | string) => {
  const { data, error, isLoading } = useSWR(
    playerId && API_BASE ? `${API_BASE}/rating/${playerId}` : null, 
    fetcher
  )
  return { rating: data?.rating as number | undefined, error, isLoading }
}

