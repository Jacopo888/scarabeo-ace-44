import { GameProvider, useGameContext } from "@/contexts/GameContext"
import { Button } from "@/components/ui/button"
import { GameFlow } from "@/components/GameFlow"
import { ScrabbleBoard } from "@/components/ScrabbleBoard"
import { TileCounter } from "@/components/TileCounter"
import { TileRack } from "@/components/TileRack"
import { TileActions } from "@/components/TileActions"
import { DictionaryLoader } from "@/components/DictionaryLoader"
import { BlankTileDialog } from "@/components/BlankTileDialog"
import { QuackleProvider, useQuackleContext } from "@/contexts/QuackleContext"
import { QuackleHealthCheck } from "@/components/QuackleHealthCheck"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Trophy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { toastOnce } from "@/lib/toastOnce"
import { useState, useEffect } from "react"
import type { Tile } from '@/types/game'
import { useIsMobile } from "@/hooks/use-mobile"
import { Link } from "react-router-dom"
import { ScorePanel } from "@/components/game/ScorePanel"
import { ActionBar } from "@/components/game/ActionBar"
import { ExchangeTilesDialog } from '@/components/ExchangeTilesDialog'
import { GameHeader } from "@/components/game/GameHeader"
import { GameResults } from "@/components/game/GameResults"
import EngineStatusBadge from "@/components/EngineStatusBadge"

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
  const { difficulty, lastEngineInfo } = useQuackleContext() as any

  // Show loading while waiting a very short time for contexts to initialize
  if (gameState.players.length === 0) {
    return (
      <div className="min-h-[50vh] bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-muted-foreground text-sm">Setting up your game...</p>
        </div>
      </div>
    )
  }

  const isMobile = useIsMobile()
  const { toast } = useToast()
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null)
  const [blankTile, setBlankTile] = useState<{ row: number, col: number, tile: Tile } | null>(null)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  // UI extras disabled

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

  // No extra tabs

  useEffect(() => {
    if (isBotTurn) {
      setSelectedTileIndex(null)
    }
  }, [isBotTurn])

  // No post-game extras

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
    return <GameResults players={gameState.players as any} onPlayAgain={resetGame} />
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6 max-w-[1400px]">
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
      <GameHeader />

      <div className="space-y-6">
        <div className="bg-card p-2 sm:p-4 md:p-6 rounded-lg shadow-lg">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <div className="flex items-center justify-center min-h-[60vh]">
              <ScrabbleBoard
                disabled={isBotTurn || currentPlayer.isBot}
                selectedTile={selectedTile}
                onUseSelectedTile={clearSelectedTile}
                boardMap={gameState.boardMatrix as any}
                pendingTiles={pendingTiles}
                onPlaceTile={(row, col, tile) => {
                  const gameTile: Tile = 'value' in tile && !('points' in tile)
                    ? { letter: tile.letter, points: Number(tile.value), isBlank: Boolean('isBlank' in tile ? tile.isBlank : false) }
                    : tile as Tile
                  if (gameTile.isBlank && (gameTile.letter === '' || gameTile.letter === '?')) {
                    setBlankTile({ row, col, tile: gameTile })
                  } else {
                    placeTile(row, col, gameTile)
                  }
                }}
                onPickupTile={pickupTile}
              />
            </div>
            <div className="flex flex-col gap-3">
              <ScorePanel players={gameState.players} className="bg-muted/40 rounded p-3" />
              <TileRack
                tiles={rackToShow}
                selectedTiles={!isBotTurn && selectedTileIndex !== null ? [selectedTileIndex] : []}
                onTileSelect={!isBotTurn ? handleTileSelect : undefined}
              />
              <div className="flex items-center justify-between">
                <ActionBar
                isBotTurn={isBotTurn}
                pendingCount={pendingTiles.length}
                rackLength={rackToShow.length}
                tileBag={gameState.tileBag as any}
                boardMap={gameState.boardMatrix as any}
                myRack={myRackForBag as any}
                opponentRack={opponentRackForBag as any}
                onConfirm={confirmMove}
                onCancel={cancelMove}
                onPass={passTurn}
                onExchange={() => setExchangeOpen(true)}
                onReshuffle={reshuffleTiles}
                />
                <div className="flex items-center gap-2 ml-3">
                  {lastEngineInfo && (
                    <div className="text-xs px-2 py-1 rounded border bg-muted/40 whitespace-nowrap" title="Engine path and settings">
                      Engine: <b>{lastEngineInfo.path === 'hl' ? 'HL' : lastEngineInfo.path === 'endgame' ? 'END' : 'GEN'}</b>
                      <span className="mx-1">•</span>
                      strict: {lastEngineInfo.hl_strict ? 'on' : 'off'}
                      <span className="mx-1">•</span>
                      k: {lastEngineInfo.kibitz_len}
                    </div>
                  )}
                  <EngineStatusBadge />
                </div>
              </div>
              {gameState.gameStatus === 'playing' && (
                <Button
                  variant="destructive"
                  className="w-full mt-1"
                  onClick={surrenderGame}
                >
                  Surrender
                </Button>
              )}
            </div>
          </div>
        </div>

      </div>
      <ExchangeTilesDialog
        open={exchangeOpen}
        onOpenChange={setExchangeOpen}
        onConfirm={(indexes) => exchangeTiles(indexes)}
      />
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
