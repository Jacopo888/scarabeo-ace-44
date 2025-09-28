import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

type Props = {
  gamesPlayed: number
  gamesWon: number
  skillLevel?: string | null
}

export function ProfileStats({ gamesPlayed, gamesWon, skillLevel }: Props) {
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <span>Games played:</span>
          <span className="font-semibold">{gamesPlayed}</span>
        </div>
        <div className="flex justify-between">
          <span>Games won:</span>
          <span className="font-semibold">{gamesWon}</span>
        </div>
        <div className="flex justify-between">
          <span>Win rate:</span>
          <span className="font-semibold">{winRate}%</span>
        </div>
        <div className="flex justify-between">
          <span>Skill level:</span>
          <span className="font-semibold">{skillLevel}</span>
        </div>
      </CardContent>
    </Card>
  )
}
