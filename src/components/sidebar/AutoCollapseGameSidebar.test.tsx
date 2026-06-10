import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AutoCollapseGameSidebar, shouldAutoCollapseSidebar } from './AutoCollapseGameSidebar'
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'

function SidebarStateProbe() {
  const { state, openMobile } = useSidebar()
  return <div data-testid="sidebar-state">{`${state}:${openMobile}`}</div>
}

function renderWithRoute(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <SidebarProvider defaultOpen>
        <AutoCollapseGameSidebar />
        <SidebarStateProbe />
      </SidebarProvider>
    </MemoryRouter>
  )
}

describe('AutoCollapseGameSidebar', () => {
  afterEach(() => {
    cleanup()
  })

  it('matches game routes only', () => {
    expect(shouldAutoCollapseSidebar('/game')).toBe(true)
    expect(shouldAutoCollapseSidebar('/multiplayer-game/abc')).toBe(true)
    expect(shouldAutoCollapseSidebar('/')).toBe(false)
    expect(shouldAutoCollapseSidebar('/dashboard')).toBe(false)
  })

  it('collapses the sidebar when entering a local or Quackle game', async () => {
    renderWithRoute('/game?mode=quackle&difficulty=medium')

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed:false')
    })
  })

  it('collapses the sidebar when entering a multiplayer game', async () => {
    renderWithRoute('/multiplayer-game/game-123')

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed:false')
    })
  })

  it('keeps the sidebar open away from games', () => {
    renderWithRoute('/')

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded:false')
  })
})
