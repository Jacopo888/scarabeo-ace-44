import { useState, useCallback } from 'react'
import { useGameContext } from '@/contexts/GameContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface GameMove {
  player: string
  words: string[]
  score: number
  turn: number
}

export const GameFlow = () => {
  const { gameState, currentPlayer, passTurn } = useGameContext()
  const [gameHistory, setGameHistory] = useState<GameMove[]>([])
  const [turnNumber, setTurnNumber] = useState(1)
  const [passCount, setPassCount] = useState(0)

  const handlePass = useCallback(() => {
    const newCount = passCount + 1
    setPassCount(newCount)

    // Game ends automatically after six consecutive passes
    passTurn()
    setTurnNumber(prev => prev + 1)
  }, [passCount, passTurn])

  const handleExchange = useCallback(() => {
    // Exchange tiles logic would go here
    passTurn()
    setTurnNumber(prev => prev + 1)
    setPassCount(0) // Reset pass count when a player makes an action
  }, [passTurn])

  const addMoveToHistory = useCallback((move: GameMove) => {
    setGameHistory(prev => [...prev, move])
    setTurnNumber(prev => prev + 1)
    setPassCount(0) // Reset pass count when a player makes a move
  }, [])

  const calculateTimeBonus = (timeLeft: number) => {
    // In real Scrabble, there's often a time bonus for quick moves
    if (timeLeft > 120) return 5 // 5 bonus points for moves under 2 minutes
    if (timeLeft > 60) return 3   // 3 bonus points for moves under 1 minute
    return 0
  }

  const getRemainingTilesPenalty = () => {
    // Calculate penalty for tiles left in rack at game end
    return currentPlayer.rack.reduce((total, tile) => total + tile.points, 0)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Game Flow Control</span>
          <Badge variant="outline">Turn {turnNumber}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Turn Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={handlePass} 
            variant="outline"
            size="sm"
          >
            Pass Turn
          </Button>
          <Button 
            onClick={handleExchange} 
            variant="outline"
            size="sm"
            disabled={gameState.tileBag.length < 7}
          >
            Exchange Tiles
          </Button>
        </div>

        <Separator />

        {/* Game Statistics */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Game Statistics</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Moves made:</span>
              <span>{gameHistory.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Pass count:</span>
              <span>{passCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Average score:</span>
              <span>
                {gameHistory.length > 0 
                  ? Math.round(gameHistory.reduce((sum, move) => sum + move.score, 0) / gameHistory.length)
                  : 0
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tiles left:</span>
              <span>{gameState.tileBag.length}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Recent Moves */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Recent Moves</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {gameHistory.slice(-5).reverse().map((move, index) => (
              <div key={index} className="text-xs p-2 bg-secondary/50 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{move.player}</span>
                  <Badge variant="secondary" className="text-xs">
                    {move.score} pts
                  </Badge>
                </div>
                <div className="text-muted-foreground">
                  {move.words.join(', ')}
                </div>
              </div>
            ))}
            {gameHistory.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                No moves yet
              </div>
            )}
          </div>
        </div>

        {/* End Game Conditions */}
        {(gameState.tileBag.length === 0 || passCount >= 5) && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm font-medium text-yellow-800">
              {gameState.tileBag.length === 0
                ? "Game ending soon - no more tiles in bag!"
                : "Game will end if any player passes again!"
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}