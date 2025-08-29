import { FC } from 'react'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'

interface TileCounterProps {
  tileBag: any[]
  className?: string
}

export const TileCounter: FC<TileCounterProps> = ({ tileBag, className }) => {
  const remainingTiles = tileBag?.length || 0

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Tessere rimanenti
          </span>
          <Badge variant="secondary" className="text-base font-bold">
            {remainingTiles}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}