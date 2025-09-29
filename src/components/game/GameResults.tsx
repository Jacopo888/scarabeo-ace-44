import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

type Player = { id: string; name: string; score: number }

export interface GameResultsProps {
  players: Player[]
  onPlayAgain: () => void
}

export const GameResults: React.FC<GameResultsProps> = ({ players, onPlayAgain }) => {
  const winner = players.reduce((prev, current) => (prev.score > current.score) ? prev : current)
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-4 flex items-center gap-4">
        <Link to="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Game Results</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Game Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-primary mb-2">
                {winner.name} Wins!
              </h2>
              <p className="text-muted-foreground">
                Final Score: {winner.score} points
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {players.map((player) => (
                <div key={player.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{player.name}</span>
                    <span className="text-2xl font-bold">{player.score}</span>
                  </div>
                  {player.id === winner.id && (
                    <div className="mt-2">
                      <Trophy className="h-4 w-4 text-yellow-500 inline mr-1" />
                      <span className="text-sm text-yellow-600">Winner</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={onPlayAgain}>Play Again</Button>
              <Link to="/">
                <Button variant="outline">Back to Home</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default GameResults
