import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'
import { render, screen } from '@testing-library/react'

// Minimal smoke: render within provider + router and assert items

describe('AppSidebar (smoke)', () => {
  it('renders brand and nav items', () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>
    )

    // Brand: either 'S' or 'Scrabble Online' depending on state
    expect(screen.getByText(/S|Scrabble Online/)).toBeTruthy()
    // Nav items
    expect(screen.getByText('Home')).toBeTruthy()
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Dictionary')).toBeTruthy()
  })
})
