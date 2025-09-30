import React from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface GameHeaderProps {
  title?: string
}

export const GameHeader: React.FC<GameHeaderProps> = ({ title = 'Tilesword Game' }) => {
  return (
    <div className="mb-4 flex items-center gap-4">
      <Link to="/">
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  )
}

export default GameHeader
