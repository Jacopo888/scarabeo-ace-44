import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// IMPORTANT: mock before importing the module under test
vi.mock('@/integrations/supabase/client', () => {
  const mockAuth = {
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    getSession: vi.fn(async () => ({ data: { session: null } })),
    signUp: vi.fn(async () => ({ data: {}, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null }))
  }
  const mockFrom = vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: null, error: null })), update: vi.fn().mockReturnThis() }))
  return {
    supabase: { auth: mockAuth, from: mockFrom },
    __mock: { mockAuth, mockFrom }
  }
})

import { AuthProvider, useAuth } from './AuthContext'
import * as ClientModule from '@/integrations/supabase/client'

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signIn calls supabase.auth.signInWithPassword', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.signIn('user@example.com', 'secret')
    })
    expect((ClientModule as any).__mock.mockAuth.signInWithPassword).toHaveBeenCalled()
  })

  it('signUp calls supabase.auth.signUp with metadata', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.signUp('new@example.com', 'secret', 'newuser')
    })
    expect((ClientModule as any).__mock.mockAuth.signUp).toHaveBeenCalled()
    const arg = (ClientModule as any).__mock.mockAuth.signUp.mock.calls[0][0]
    expect(arg.options.data.username).toBe('newuser')
  })

  it('signOut calls supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.signOut()
    })
    expect((ClientModule as any).__mock.mockAuth.signOut).toHaveBeenCalled()
  })

  it('exposes loading=false after init', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
