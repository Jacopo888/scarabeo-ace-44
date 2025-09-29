import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotifications } from '../useNotifications'

// Minimal mocks for contexts consumed in the hook
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/integrations/supabase/client', () => ({ supabase: { channel: () => ({ on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }) }), removeChannel: () => {}, from: () => ({ select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) }) } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))

describe('useNotifications', () => {
  it('adds and manages notifications', () => {
    const { result } = renderHook(() => useNotifications())

    act(() => {
      result.current.addNotification({ type: 'game_found', title: 'T', message: 'M' })
    })

    expect(result.current.unreadCount).toBe(1)

    const id = (result.current as any).notifications[0].id

    act(() => {
      result.current.markAsRead(id)
    })
    expect(result.current.unreadCount).toBe(0)

    act(() => {
      result.current.removeNotification(id)
    })
    expect((result.current as any).notifications.length).toBe(0)
  })
})
