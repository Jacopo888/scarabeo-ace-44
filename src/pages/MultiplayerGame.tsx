import { useParams, Navigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrabbleBoard } from '@/components/ScrabbleBoard'
import { TileRack } from '@/components/TileRack'
import { TileCounter } from '@/components/TileCounter'
import { ExchangeTilesDialog } from '@/components/ExchangeTilesDialog'
import { GameChat } from '@/components/GameChat'
import { useState, useEffect } from 'react'
import { BlankTileDialog } from '@/components/BlankTileDialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame'
import { useAuth } from '@/contexts/AuthContext'
import { Clock, User, Trophy, ArrowLeft } from 'lucide-react'
import { usePlayerRating } from '@/hooks/usePlayerRating'
import { useGameAnalysis } from "@/hooks/useGameAnalysis"
import { formatTimeRemaining } from '@/utils/timeUtils'

export default function MultiplayerGame() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuth()
  
  if (!gameId) {
    return <Navigate to="/dashboard" replace />
  }

  return <MultiplayerGameContent gameId={gameId} />
}

function MultiplayerGameContent({ gameId }: { gameId: string }) {
  const { user } = useAuth()
  const {
    game,
    gameState,
    pendingTiles,
    loading,
    isMyTurn,
    placeTile,
    pickupTile,
    submitMove,
    exchangeTiles,
    passTurn,
    surrenderGame,
    getOpponentInfo,
    getMyScore,
    getCurrentRack
  } = useMultiplayerGame(gameId)

  const isMobile = useIsMobile()
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [blankTile, setBlankTile] = useState<{ row: number, col: number, tile: any } | null>(null)
  const { moves, analysis, analyzeGame, loading: analysisLoading } = useGameAnalysis(gameId)

  const opponentId =
    game && user ? (game.player1_id === user.id ? game.player2_id : game.player1_id) : undefined

  const { rating: myRating } = usePlayerRating(user?.id)
  const { rating: opponentRating } = usePlayerRating(opponentId)

  const handleTileSelect = (index: number) => {
    if (!isMobile) return
    setSelectedTileIndex(prev => (prev === index ? null : index))
  }

  const clearSelectedTile = () => setSelectedTileIndex(null)

  useEffect(() => {
    if (!isMyTurn) {
      setSelectedTileIndex(null)
    }
  }, [isMyTurn])

  // Start analysis when game finishes
  useEffect(() => {
    if (game?.status === 'completed' && moves.length > 0) {
      analyzeGame()
    }
  }, [game?.status, moves.length, analyzeGame])

  const handleExchange = (indexes: number[]) => {
    exchangeTiles(indexes)
  }

  if (!game || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Game not found</h1>
          <Link to="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const opponent = getOpponentInfo()
  const myScore = getMyScore()
  const currentRack = getCurrentRack()

  const selectedTile =
    selectedTileIndex !== null ? (currentRack as any)[selectedTileIndex] : null

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    )
  }

  const canSubmitMove = isMyTurn && pendingTiles.length > 0
  const gameStatus = game.status === 'waiting' ? 'Waiting for second player' :
                    isMyTurn ? "It's your turn" : "Opponent's turn"

  return (
    <div className="min-h-screen bg-background">
      <BlankTileDialog
        open={!!blankTile}
        onOpenChange={(open) => {
          if (!open) setBlankTile(null)
        }}
        onSelect={(letter) => {
          if (blankTile) {
            placeTile(blankTile.row, blankTile.col, { ...blankTile.tile, letter })
            setBlankTile(null)
          }
        }}
      />
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Multiplayer Game</h1>
          </div>
          <Badge variant={isMyTurn ? "default" : "secondary"}>
            {gameStatus}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <ScrabbleBoard
                  disabled={!isMyTurn}
                  selectedTile={selectedTile as any}
                  onUseSelectedTile={clearSelectedTile}
                  boardMap={gameState.board}
                  pendingTiles={pendingTiles}
                  onPlaceTile={(row, col, tile) => {
                    const gameTile = 'value' in tile && !('points' in tile)
                      ? { letter: tile.letter, points: (tile as any).value, isBlank: (tile as any).isBlank }
                      : tile as any
                    if (gameTile.isBlank && gameTile.letter === '') {
                      setBlankTile({ row, col, tile: gameTile })
                    } else {
                      placeTile(row, col, gameTile)
                    }
                  }}
                  onPickupTile={pickupTile}
                />
                <div className="flex justify-end mt-4">
                  <TileCounter
                    tileBag={game?.tile_bag || []}
                    className="w-20 text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Current Player Rack and Actions */}
            {game.status === 'active' && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Your tiles</span>
                    {isMyTurn && (
                      <span className="text-sm font-normal text-muted-foreground">
                        It's your turn - play!
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TileRack
                    tiles={currentRack as any}
                    selectedTiles={selectedTileIndex !== null ? [selectedTileIndex] : []}
                    onTileSelect={handleTileSelect}
                  />
                  
                  {isMyTurn && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={submitMove}
                        disabled={!canSubmitMove}
                        className="flex-1"
                      >
                        Submit Move ({pendingTiles.length} tiles)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={passTurn}
                      >
                        Pass Turn
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setExchangeOpen(true)}
                      >
                        Exchange Tiles
                      </Button>
                    </div>
                  )}
                  
                  {!isMyTurn && (
                    <div className="mt-4 p-3 bg-muted rounded-lg text-center">
                      <p className="text-muted-foreground">
                        Waiting for opponent's turn...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Game Info Sidebar */}
          <div className="space-y-6">
            {/* Scores */}
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
                      {opponent?.name || 'Opponent'}{' '}
                      {opponentRating !== undefined && (
                        <span className="text-xs text-muted-foreground">({opponentRating})</span>
                      )}
                    </span>
                  </div>
                  <span className="font-bold text-lg">{opponent?.score || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Game Info */}
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
                
                {game.turn_deadline && (
                  <div>
                    <p className="text-sm text-muted-foreground">Time remaining:</p>
                    <p className="font-semibold">{formatTimeRemaining(game.turn_deadline)}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-muted-foreground">Turn duration:</p>
                  <p className="font-semibold">
                    {game.turn_duration === '1h' ? '1 hour' :
                     game.turn_duration === '6h' ? '6 hours' :
                     game.turn_duration === '24h' ? '24 hours' : '48 hours'}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Opponent:</p>
                  <p className="font-semibold">{opponent?.name || 'Waiting...'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Game Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/dashboard">
                  <Button variant="outline" className="w-full">
                    Back to Dashboard
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.reload()}
                >
                  Refresh Game
                </Button>
                {game.status === 'completed' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={analyzeGame}
                    disabled={analysisLoading}
                  >
                    {analysisLoading ? 'Analyzing...' : 'Analyze Game'}
                  </Button>
                )}
                {game.status === 'active' && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={surrenderGame}
                  >
                    Surrender
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Analysis Results */}
            {analysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Game Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Missed Opportunities</h4>
                      <p className="text-sm text-muted-foreground">
                        {analysis.missed.length} missed better moves
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Bingo Chances</h4>
                      <p className="text-sm text-muted-foreground">
                        {analysis.bingoChances.filter(b => b.found).length} bingos found
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Performance</h4>
                      <p className="text-sm text-muted-foreground">
                        Analysis of {moves.length} moves completed
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Game Info Section */}
      <div className="mt-6">
        <GameChat gameId={gameId} />
      </div>
      <ExchangeTilesDialog
        open={exchangeOpen}
        onOpenChange={setExchangeOpen}
        onConfirm={handleExchange}
      />
    </div>
  </div>
)
}
