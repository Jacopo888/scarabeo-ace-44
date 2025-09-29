import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GameHeader } from '../GameHeader'

describe('GameHeader', () => {
  it('renders title and back button', () => {
    render(
      <MemoryRouter>
        <GameHeader title="My Title" />
      </MemoryRouter>
    )
    expect(screen.getByText('My Title')).toBeInTheDocument()
    expect(screen.getByText('Back to Home')).toBeInTheDocument()
  })
})
