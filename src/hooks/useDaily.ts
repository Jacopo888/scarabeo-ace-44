import { useQuery } from '@tanstack/react-query';
import { getDailyToday, getDailyLeaderboard } from '@/api/daily';

export function useDailyPuzzle() {
  return useQuery({
    queryKey: ['daily', 'today'],
    queryFn: getDailyToday,
    refetchOnWindowFocus: false,
  });
}

export function useDailyLeaderboard(yyyymmdd?: number) {
  return useQuery({
    queryKey: ['daily', 'leaderboard', yyyymmdd],
    queryFn: () => getDailyLeaderboard(yyyymmdd),
    refetchInterval: 15000,
  });
}
