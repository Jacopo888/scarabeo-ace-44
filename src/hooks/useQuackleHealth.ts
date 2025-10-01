import { useEffect, useState } from 'react'
import { quackleHealth } from '@/services/quackleClient'
import type { QuackleHealthResult } from '@/services/quackleClient'

export type QuackleHealthStatus = 'checking' | 'healthy' | 'unhealthy'

export interface QuackleHealthSnapshot {
  status: QuackleHealthStatus
  result: QuackleHealthResult | null
  lastCheckedAt: number | null
}

const INITIAL_SNAPSHOT: QuackleHealthSnapshot = {
  status: 'checking',
  result: null,
  lastCheckedAt: null
}

export function useQuackleHealth(pollMs: number = 30000): QuackleHealthSnapshot {
  const [snapshot, setSnapshot] = useState<QuackleHealthSnapshot>(INITIAL_SNAPSHOT)
  const interval = Math.max(5000, pollMs | 0) // clamp to >=5s

  useEffect(() => {
    let mounted = true

    const tick = async () => {
      try {
        const res = await quackleHealth()
        if (!mounted) return
        setSnapshot({
          status: res.ok ? 'healthy' : 'unhealthy',
          result: res,
          lastCheckedAt: Date.now()
        })
      } catch {
        if (!mounted) return
        setSnapshot(prev => ({
          status: 'unhealthy',
          result: prev.result,
          lastCheckedAt: Date.now()
        }))
      }
    }

    tick()
    const id = setInterval(tick, interval)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [interval])

  return snapshot
}
