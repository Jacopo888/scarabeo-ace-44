import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Trophy, User } from "lucide-react"

export function ScoreCard(props: {
  myScore: number
  myRating?: number
  opponentName?: string
  opponentScore: number
  opponentRating?: number
}) {
  const { myScore, myRating, opponentName, opponentScore, opponentRating } = props
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Scores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>
              You {myRating !== undefined && (
                <span className="text-xs text-muted-foreground">({myRating})</span>
              )}
            </span>
          </div>
          <span className="font-bold text-lg">{myScore}</span>
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>
              {opponentName || 'Opponent'} {opponentRating !== undefined && (
                <span className="text-xs text-muted-foreground">({opponentRating})</span>
              )}
            </span>
          </div>
          <span className="font-bold text-lg">{opponentScore}</span>
        </div>
      </CardContent>
    </Card>
  )
}
