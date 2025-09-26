import { GameProvider, useGameContext } from "@/contexts/GameContext"
import { Button } from "@/components/ui/button"
import { GameFlow } from "@/components/GameFlow"
import { ScrabbleBoard } from "@/components/ScrabbleBoard"
import { TileCounter } from "@/components/TileCounter"
import { TileRack } from "@/components/TileRack"
import { TileActions } from "@/components/TileActions"
import { DictionaryLoader } from "@/components/DictionaryLoader"
// Analysis removed per request
import { BlankTileDialog } from "@/components/BlankTileDialog"
import { QuackleProvider, useQuackleContext } from "@/contexts/QuackleContext"
import { QuackleHealthCheck } from "@/components/QuackleHealthCheck"
// Tabs for analysis removed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Trophy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { toastOnce } from "@/lib/toastOnce"
import { useState, useEffect } from "react"
import type { Tile } from '@/types/game'
import { useIsMobile } from "@/hooks/use-mobile"
import { Link } from "react-router-dom"

const GameContent = () => {
  const {
    gameState,
    pendingTiles,
    placeTile,
    pickupTile,
    confirmMove,
    cancelMove,
    resetGame,
    currentPlayer,
    reshuffleTiles,
    passTurn,
    exchangeTiles,
    isBotTurn,
    surrenderGame,
    isSurrendered,
    moveHistory,
    gameId
  } = useGameContext()
  const { difficulty } = useQuackleContext()

  // Show loading state while waiting for game initialization
  if (gameState.players.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Setting up your game...</p>
        </div>
      </div>
    )
  }

  const isMobile = useIsMobile()
  const { toast } = useToast()
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null)
  const [blankTile, setBlankTile] = useState<{ row: number, col: number, tile: Tile } | null>(null)
  // Analysis disabled

  const humanPlayer = gameState.players.find(p => !p.isBot) || currentPlayer
  const rackToShow = gameState.gameMode === 'quackle' ? (humanPlayer?.rack || []) : (currentPlayer?.rack || [])
  const myRackForBag = gameState.gameMode === 'quackle' ? (humanPlayer?.rack || []) : (currentPlayer?.rack || [])
  const opponentRackForBag = (() => {
    if (gameState.players.length < 2) return [] as any
    const myId = gameState.gameMode === 'quackle' ? (humanPlayer?.id || currentPlayer.id) : currentPlayer.id
    const opp = gameState.players.find(p => p.id !== myId)
    return opp?.rack || []
  })()

  const selectedTile = selectedTileIndex !== null && !isBotTurn
    ? {
        ...rackToShow[selectedTileIndex],
        id: `tile-${selectedTileIndex}`,
        value: rackToShow[selectedTileIndex].points
      }
    : null

  const handleTileSelect = (index: number) => {
    if (!isMobile) return
    setSelectedTileIndex(prev => (prev === index ? null : index))
  }

  const clearSelectedTile = () => setSelectedTileIndex(null)

  // No analysis tab

  useEffect(() => {
    if (isBotTurn) {
      setSelectedTileIndex(null)
    }
  }, [isBotTurn])

  // No post-game analysis

  // Toast when Quackle has fewer than 5 tiles remaining
  useEffect(() => {
    if (gameState.gameMode !== 'quackle') return
    if (gameState.gameStatus === 'finished') return
    const remaining = (opponentRackForBag?.length ?? 0)
    if (remaining < 5) {
      toastOnce(toast, `quackle-low-tiles-${remaining}`,
        `quackle has ${remaining} tiles remaining`)
    }
  }, [opponentRackForBag?.length, gameState.gameMode, gameState.gameStatus, toast])

  if (gameState.gameStatus === 'finished') {
    const winner = gameState.players.reduce((prev, current) => (prev.score > current.score) ? prev : current)
    
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
                {gameState.players.map(player => (
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
                <Button onClick={resetGame}>
                  Play Again
                </Button>
                <Link to="/">
                  <Button variant="outline">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
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
      <div className="mb-4 flex items-center gap-4">
        <Link to="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Scrabble Game</h1>
      </div>

      <div className="space-y-6">
        <div className="space-y-6">
          <div className="bg-card p-2 sm:p-6 rounded-lg shadow-lg relative">
            <div className="flex justify-center">
              <ScrabbleBoard
                disabled={isBotTurn || currentPlayer.isBot}
                selectedTile={selectedTile}
                onUseSelectedTile={clearSelectedTile}
                boardMap={gameState.board}
                pendingTiles={pendingTiles}
                onPlaceTile={(row, col, tile) => {
                  const gameTile: Tile = 'value' in tile && !('points' in tile)
                    ? { letter: tile.letter, points: Number(tile.value), isBlank: Boolean('isBlank' in tile ? tile.isBlank : false) }
                    : tile as Tile
                  if (gameTile.isBlank && gameTile.letter === '') {
                    setBlankTile({ row, col, tile: gameTile })
                  } else {
                    placeTile(row, col, gameTile)
                  }
                }}
                onPickupTile={pickupTile}
              />
              <div className="absolute bottom-2 right-2 bg-secondary rounded p-2 text-sm shadow">
                {gameState.players.map(p => (
                  <div key={p.id} className="flex justify-between gap-4">
                    <span>{p.name}</span>
                    <span className="font-medium">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <TileCounter
                tileBag={gameState.tileBag as any}
                boardMap={gameState.board as any}
                myRack={myRackForBag as any}
                opponentRack={opponentRackForBag as any}
                className="w-32 text-xs"
              />
            </div>
            <div className="mt-4 sm:mt-6 space-y-4 pb-20 sm:pb-0">
              <TileRack
                tiles={rackToShow}
                selectedTiles={!isBotTurn && selectedTileIndex !== null ? [selectedTileIndex] : []}
                onTileSelect={!isBotTurn ? handleTileSelect : undefined}
              />
              {!isBotTurn && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    onClick={confirmMove}
                    disabled={pendingTiles.length === 0}
                  >
                    Confirm Move
                  </Button>
                  <Button
                    onClick={cancelMove}
                    variant="outline"
                    disabled={pendingTiles.length === 0}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={passTurn}
                    variant="outline"
                  >
                    Pass Turn
                  </Button>
                  <Button
                    onClick={exchangeTiles}
                    variant="outline"
                    disabled={gameState.tileBag.length < rackToShow.length}
                  >
                    Swap Tiles
                  </Button>
                  <Button
                    onClick={reshuffleTiles}
                    variant="outline"
                  >
                    Reshuffle Tiles
                  </Button>
                </div>
              )}
              {gameState.gameStatus === 'playing' && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={surrenderGame}
                >
                  Surrender
                </Button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

const Game = () => {
  return (
    <QuackleProvider>
      <GameProvider>
        <div className="min-h-screen bg-background">
          <DictionaryLoader />
          <QuackleHealthCheck />
          <GameContent />
        </div>
      </GameProvider>
    </QuackleProvider>
  )
}

export default Game
