import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Target } from 'lucide-react'

type Duration = '1h' | '6h' | '24h' | '48h'

type Props = {
  isInQueue: boolean
  loading: boolean
  onJoin: (duration: Duration) => void
  onLeave: () => void
}

export function MatchmakingCard({ isInQueue, loading, onJoin, onLeave }: Props) {
  const [preferredDuration, setPreferredDuration] = useState<Duration>('24h')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Matchmaking
        </CardTitle>
        <CardDescription>Find an opponent for a new match</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isInQueue ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Preferred turn duration:</label>
              <Select value={preferredDuration} onValueChange={(v) => setPreferredDuration(v as Duration)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="48h">48 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => onJoin(preferredDuration)} disabled={loading} className="w-full">
              {loading ? 'Searching...' : 'Find Match'}
            </Button>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Target className="h-5 w-5 animate-pulse" />
              <span>In matchmaking queue...</span>
            </div>
            <Button variant="outline" onClick={onLeave} disabled={loading} className="w-full">
              Leave queue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
