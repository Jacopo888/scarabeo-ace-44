import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Sandbox from './Sandbox'

describe('Sandbox editor', () => {
  afterEach(() => cleanup())

  it('lets the board letter input change away from A', () => {
    render(<Sandbox />)

    const input = screen.getByLabelText('Board letter') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'AB' } })

    expect(input.value).toBe('B')
  })

  it('selects a board square and writes letters with keyboard navigation', () => {
    render(<Sandbox />)

    fireEvent.click(screen.getByLabelText('row 8 col 8'))
    const board = screen.getByRole('grid', { name: 'Sandbox board' })
    fireEvent.keyDown(board, { key: 'ArrowRight' })
    fireEvent.keyDown(board, { key: 'B' })

    expect(screen.getByLabelText('row 8 col 9')).toHaveTextContent('B')
  })
})
