import React from 'react'
import { useQuackleContext } from '@/contexts/QuackleContext'

// Small inline badge indicating engine status (simulations/endgame/static)
export const EngineStatusBadge: React.FC<{ className?: string }> = ({ className }) => {
  const { lastEngineInfo } = useQuackleContext() as any
  if (!lastEngineInfo) return null

  const { status, used_simulator, path } = lastEngineInfo

  // Show only when simulating or simulator was used (late game). Keep it subtle.
  const isSim = status === 'simulating' || used_simulator === true
  if (!isSim) return null

  const label = 'Montecarlo Simulations…'
  const enginePath = path === 'endgame' ? 'Endgame' : path === 'hl' ? 'HL' : 'GEN'

  return (
    <div className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded border bg-muted/40 ${className || ''}`} title={`Engine status: ${status || 'simulating'} (path=${enginePath})`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
      </span>
      <span>{label}</span>
    </div>
  )
}

export default EngineStatusBadge
