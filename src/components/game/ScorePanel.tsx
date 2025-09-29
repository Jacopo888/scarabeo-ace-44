import React from 'react'

type Player = { id: string; name: string; score: number }

export interface ScorePanelProps {
  players: Player[]
  className?: string
}

export const ScorePanel: React.FC<ScorePanelProps> = ({ players, className }) => {
  return (
    <div className={className}>
      <div className="font-medium mb-2">Scores</div>
      <div className="space-y-1">
        {players.map((p) => (
          <div key={p.id} className="flex justify-between gap-4 text-sm">
            <span>{p.name}</span>
            <span className="font-semibold">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ScorePanel
