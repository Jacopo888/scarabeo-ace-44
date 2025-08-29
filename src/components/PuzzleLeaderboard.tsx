import { formatDistanceToNow } from 'date-fns'
import { Trophy, Medal, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePuzzleLeaderboard } from '@/hooks/usePuzzle'
import { cn } from '@/lib/utils'

const getRankIcon = (position: number) => {
  if (position === 1) return <Trophy className="h-4 w-4 text-yellow-500" />
  if (position === 2) return <Medal className="h-4 w-4 text-gray-400" />
  if (position === 3) return <Award className="h-4 w-4 text-amber-600" />
  return <span className="text-sm font-medium text-muted-foreground">#{position}</span>
}

const safeFormatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'just now'
    }
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return 'just now'
  }
}

export function PuzzleLeaderboard() {
  const { data: leaderboard, error, isLoading } = usePuzzleLeaderboard()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Puzzle 90s Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Leaderboard unavailable
          </p>
        ) : !leaderboard || leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scores yet. Be the first!
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg transition-colors",
                  index < 3 ? "bg-muted/50" : "hover:bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3">
                  {getRankIcon(index + 1)}
                  <span className="font-medium text-sm truncate max-w-24">
                    {entry.user_id}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{entry.score}</span>
                  <span className="text-muted-foreground">
                    {safeFormatDate(entry.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}