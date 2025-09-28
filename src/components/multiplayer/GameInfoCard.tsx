import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"
import { formatTimeRemaining } from "@/utils/time"
import type { GameRecord } from "@/types/multiplayer"

export function GameInfoCard(props: {
  gameStatus: string
  turn_deadline: string | null | undefined
  turn_duration: GameRecord['turn_duration'] | null
  opponentName?: string
}) {
  const { gameStatus, turn_deadline, turn_duration, opponentName } = props
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Game Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Status:</p>
          <p className="font-semibold">{gameStatus}</p>
        </div>
        {turn_deadline && (
          <div>
            <p className="text-sm text-muted-foreground">Time remaining:</p>
            <p className="font-semibold">{formatTimeRemaining(turn_deadline)}</p>
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">Turn duration:</p>
          <p className="font-semibold">
            {turn_duration === '1h' ? '1 hour' :
             turn_duration === '6h' ? '6 hours' :
             turn_duration === '24h' ? '24 hours' : '48 hours'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Opponent:</p>
          <p className="font-semibold">{opponentName || 'Waiting...'}</p>
        </div>
      </CardContent>
    </Card>
  )
}
