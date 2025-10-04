import React from 'react'
import { Button } from '@/components/ui/button'
import { TileCounter } from '@/components/TileCounter'
import type { Tile } from '@/types/game'

export interface ActionBarProps {
  isBotTurn: boolean
  pendingCount: number
  rackLength: number
  tileBag: Tile[]
  boardMap: any
  myRack: any
  opponentRack: any
  onConfirm: () => void
  onCancel: () => void
  onPass: () => void
  onExchange: () => void
  onReshuffle: () => void
}

export const ActionBar: React.FC<ActionBarProps> = ({
  isBotTurn,
  pendingCount,
  rackLength,
  tileBag,
  boardMap,
  myRack,
  opponentRack,
  onConfirm,
  onCancel,
  onPass,
  onExchange,
  onReshuffle,
}) => {
  if (isBotTurn) return null
  return (
    <div className="flex flex-wrap justify-center xl:justify-start gap-2">
      <Button onClick={onConfirm} disabled={pendingCount === 0}>
        Confirm Move
      </Button>
      <Button onClick={onCancel} variant="outline" disabled={pendingCount === 0}>
        Cancel
      </Button>
      <Button onClick={onPass} variant="outline">
        Pass Turn
      </Button>
      <Button onClick={onExchange} variant="outline">
        Swap Tiles
      </Button>
      <Button onClick={onReshuffle} variant="outline">
        Reshuffle Tiles
      </Button>
      <TileCounter
        tileBag={tileBag as any}
        boardMap={boardMap as any}
        myRack={myRack as any}
        opponentRack={opponentRack as any}
        className="w-40 text-xs"
      />
    </div>
  )
}

export default ActionBar
