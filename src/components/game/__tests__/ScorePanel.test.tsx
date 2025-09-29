import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScorePanel } from '../ScorePanel'

describe('ScorePanel', () => {
  it('renders player names and scores', () => {
    render(<ScorePanel className="test" players={[{ id: '1', name: 'Alice', score: 10 }, { id: '2', name: 'Bob', score: 20 }]} />)
    expect(screen.getByText('Scores')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })
})
