import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GameRecord } from '@/types/multiplayer'
import { formatTimeRemaining } from '@/utils/time'

type Props = {
  userId: string
  games: GameRecord[]
}

function getGameStatus(game: GameRecord, userId: string) {
  if (game.status === 'waiting') return 'In attesa'
  if (game.current_player_id === userId) return 'Il tuo turno'
  return 'Turno avversario'
}

function getStatusColor(game: GameRecord, userId: string) {
  if (game.status === 'waiting') return 'secondary' as const
  if (game.current_player_id === userId) return 'default' as const
  return 'outline' as const
}

function getOpponentName(game: any, userId: string) {
  const isPlayer1 = game.player1_id === userId
  const opponent = isPlayer1 ? game.player2 : game.player1
  return opponent?.display_name || opponent?.username || 'Opponent'
}

function getMyScore(game: GameRecord, userId: string) {
  return game.player1_id === userId ? game.player1_score : game.player2_score
}

function getOpponentScore(game: GameRecord, userId: string) {
  return game.player1_id === userId ? game.player2_score : game.player1_score
}

export function ActiveGamesList({ userId, games }: Props) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Active Games ({games.length})
        </CardTitle>
        <CardDescription>Your ongoing games</CardDescription>
      </CardHeader>
      <CardContent>
        {games.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No active games. Start a new one via matchmaking!
          </p>
        ) : (
          <div className="space-y-4">
            {games.map((game) => (
              <div key={game.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">vs {getOpponentName(game as any, userId)}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(game.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={getStatusColor(game, userId)}>{getGameStatus(game, userId)}</Badge>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm">
                    You: <span className="font-semibold">{getMyScore(game, userId)}</span> -
                    {' '}Opponent: <span className="font-semibold">{getOpponentScore(game, userId)}</span>
                  </div>
                  {game.turn_deadline && (
                    <div className="text-sm text-muted-foreground">
                      Expires: {formatTimeRemaining(game.turn_deadline)}
                    </div>
                  )}
                </div>
                <Link to={`/multiplayer-game/${game.id}`}>
                  <Button size="sm">{game.current_player_id === userId ? 'Play your turn' : 'View game'}</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
