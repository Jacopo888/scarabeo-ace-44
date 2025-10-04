import { useParams, Navigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExchangeTilesDialog } from '@/components/ExchangeTilesDialog'
import { GameChat } from '@/components/GameChat'
import { useState, useEffect } from 'react'
import { BlankTileDialog } from '@/components/BlankTileDialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame'
import { useAuth } from '@/contexts/AuthContext'
import { usePlayerRating } from '@/hooks/usePlayerRating'
import { MultiplayerHeader } from '@/components/multiplayer/MultiplayerHeader'
import { BoardPanel } from '@/components/multiplayer/BoardPanel'
import { RackAndActions } from '@/components/multiplayer/RackAndActions'
import { ScoreCard } from '@/components/multiplayer/ScoreCard'
import { GameInfoCard } from '@/components/multiplayer/GameInfoCard'
import { ActionsCard } from '@/components/multiplayer/ActionsCard'

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
  // Extra features disabled

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

  // No post-game extras

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
        <MultiplayerHeader gameStatus={gameStatus} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <BoardPanel
                  isMyTurn={isMyTurn}
                  selectedTile={selectedTile as any}
                  onUseSelectedTile={clearSelectedTile}
                  boardMap={gameState.boardMatrix as any}
                  pendingTiles={pendingTiles}
                  onPlaceTile={(row, col, tile) => {
                    const t: any = tile
                    const gameTile: any = 'value' in t && !('points' in t)
                      ? { letter: t.letter, points: t.value, isBlank: t.isBlank }
                      : t
                    if (gameTile?.isBlank && (gameTile.letter === '' || gameTile.letter === '?')) {
                      setBlankTile({ row, col, tile: gameTile })
                    } else {
                      placeTile(row, col, gameTile)
                    }
                  }}
                  onPickupTile={pickupTile}
                  onRequestBlank={(row, col, tile) => setBlankTile({ row, col, tile })}
                />
                {/* Tile counter moved below rack/actions */}
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
                  <RackAndActions
                    currentRack={currentRack as any}
                    selectedTileIndex={selectedTileIndex}
                    onTileSelect={handleTileSelect}
                    isMyTurn={isMyTurn}
                    canSubmitMove={canSubmitMove}
                    pendingCount={pendingTiles.length}
                    submitMove={submitMove}
                    passTurn={passTurn}
                    onOpenExchange={() => setExchangeOpen(true)}
                    tileCounter={{
                      tileBag: game?.tile_bag || [],
                      boardMap: gameState.boardMatrix as any,
                      myRack: getCurrentRack() as any,
                      opponentRack: (game.player1_id === user.id ? game.player2_rack : game.player1_rack) as any,
                      className: "w-40 text-xs ml-auto"
                    }}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Game Info Sidebar */}
          <div className="space-y-6">
            <ScoreCard
              myScore={myScore}
              myRating={myRating}
              opponentName={opponent?.name}
              opponentScore={opponent?.score || 0}
              opponentRating={opponentRating}
            />

            <GameInfoCard
              gameStatus={gameStatus}
              turn_deadline={game.turn_deadline}
              turn_duration={game.turn_duration}
              opponentName={opponent?.name}
            />

            <ActionsCard isActive={game.status === 'active'} onSurrender={surrenderGame} />
            {/* Extra results removed */}
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
