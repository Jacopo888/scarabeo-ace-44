import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActionBar } from '../ActionBar'

const baseProps = {
  isBotTurn: false,
  pendingCount: 1,
  rackLength: 7,
  tileBag: [],
  boardMap: {},
  myRack: [],
  opponentRack: [],
  onConfirm: () => {},
  onCancel: () => {},
  onPass: () => {},
  onExchange: () => {},
  onReshuffle: () => {},
}

describe('ActionBar', () => {
  it('hides when isBotTurn', () => {
    render(<ActionBar {...baseProps} isBotTurn={true} />)
    expect(screen.queryByText('Confirm Move')).not.toBeInTheDocument()
  })

  it('shows actions when human turn', async () => {
    render(<ActionBar {...baseProps} />)
    expect(screen.getByText('Confirm Move')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Pass Turn')).toBeInTheDocument()
    expect(screen.getByText('Swap Tiles')).toBeInTheDocument()
    expect(screen.getByText('Reshuffle Tiles')).toBeInTheDocument()
    // ensure button is enabled due to pendingCount > 0
    expect(screen.getByText('Confirm Move')).not.toHaveAttribute('disabled')
  })
})
