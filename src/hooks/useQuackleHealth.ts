import { useEffect, useMemo, useState } from 'react'
import { quackleHealth } from '@/services/quackleClient'

export type QuackleHealthStatus = 'checking' | 'healthy' | 'unhealthy'

export function useQuackleHealth(pollMs: number = 30000): QuackleHealthStatus {
  const [status, setStatus] = useState<QuackleHealthStatus>('checking')
  const interval = Math.max(5000, pollMs | 0) // clamp to >=5s

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        const h = await quackleHealth()
        if (!mounted) return
        setStatus(h.ok ? 'healthy' : 'unhealthy')
      } catch {
        if (!mounted) return
        setStatus('unhealthy')
      }
    }
    tick()
    const id = setInterval(tick, interval)
    return () => { mounted = false; clearInterval(id) }
  }, [interval])

  return status
}
