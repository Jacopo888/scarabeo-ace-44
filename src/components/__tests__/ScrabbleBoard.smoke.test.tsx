import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScrabbleBoard } from '@/components/ScrabbleBoard'

import type { PlacedTile } from '@/types/game'

const boardMap = new Map<string, PlacedTile>()

describe('ScrabbleBoard (smoke)', () => {
  it('renders center STAR square', () => {
    render(<ScrabbleBoard boardMap={boardMap} pendingTiles={[]} />)
    // The STAR uses the ★ symbol
    expect(screen.getByText('★')).toBeTruthy()
  })
})
