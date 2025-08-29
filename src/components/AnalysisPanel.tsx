import { useState, useEffect } from 'react'
import type { AnalysisResponse } from '@/api/analysis'
import type { GameMove } from '@/hooks/useGameAnalysis'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { CheckCircle, XCircle, TrendingUp, Lightbulb } from 'lucide-react'

interface AnalysisPanelProps {
  analysis?: AnalysisResponse
  moves: GameMove[]
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis, moves }) => {
  if (!analysis) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No analysis available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Missed Best Moves ({analysis.missed.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.missed.length === 0 ? (
            <p className="text-muted-foreground">You played optimally! No better moves were found.</p>
          ) : (
            <div className="space-y-3">
              {analysis.missed.slice(0, 5).map((miss, index) => (
                <div key={index} className="p-3 bg-destructive/10 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Turn {miss.turn}: {miss.betterWord}</p>
                      <p className="text-sm text-muted-foreground">
                        Position: Row {miss.coords[0] + 1}, Col {miss.coords[1] + 1} ({miss.dir})
                      </p>
                    </div>
                    <Badge variant="destructive">+{miss.scoreGain}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Score Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analysis.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="turn" />
              <YAxis />
              <RechartsTooltip />
              <Line type="monotone" dataKey="cumMy" stroke="hsl(var(--primary))" name="Your Score" />
              <Line type="monotone" dataKey="cumOpp" stroke="hsl(var(--destructive))" name="Opponent" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Bingo Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.bingoChances.map((bingo, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Turn {bingo.turn}</p>
                  {bingo.bestBingo && (
                    <p className="text-sm text-muted-foreground">
                      Best: {bingo.bestBingo} ({bingo.score} pts)
                    </p>
                  )}
                </div>
                <Badge variant={bingo.found ? "default" : "secondary"}>
                  {bingo.found ? "Found!" : "Missed"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-warning" />
            Rack Management Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.rackAdvice.map((advice, index) => (
              <div key={index} className="p-3 bg-warning/10 rounded-lg">
                <p className="font-medium">Turn {advice.turn}: Keep "{advice.keep}"</p>
                <p className="text-sm text-muted-foreground">{advice.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}