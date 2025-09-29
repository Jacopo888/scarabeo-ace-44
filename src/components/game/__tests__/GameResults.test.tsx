import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GameResults } from '../GameResults'

describe('GameResults', () => {
  it('shows winner and actions', () => {
    const onPlayAgain = vi.fn()
    render(
      <MemoryRouter>
        <GameResults
          players={[
            { id: '1', name: 'Alice', score: 30 },
            { id: '2', name: 'Bob', score: 20 },
          ]}
          onPlayAgain={onPlayAgain}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Game Results')).toBeInTheDocument()
    expect(screen.getByText('Alice Wins!')).toBeInTheDocument()
    expect(screen.getByText('Final Score: 30 points')).toBeInTheDocument()
    expect(screen.getByText('Play Again')).toBeInTheDocument()
    // There are two "Back to Home" buttons: one in the header and one in the actions
    expect(screen.getAllByText('Back to Home')).toHaveLength(2)
  })
})
