import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLobbySocket, LobbyEntry } from '@/hooks/useLobbySocket'
import { usePlayerRating } from '@/hooks/usePlayerRating'

function LobbyItem({ lobby }: { lobby: LobbyEntry }) {
  const { rating } = usePlayerRating(lobby.host)
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {lobby.host} {rating !== undefined && <span className="text-sm text-muted-foreground">({rating})</span>}
          {'\'s game'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span>
          {lobby.players}/{lobby.maxPlayers} players
        </span>
        <Button size="sm">Join</Button>
      </CardContent>
    </Card>
  )
}

function LobbyList({ lobbies }: { lobbies: LobbyEntry[] }) {
  if (lobbies.length === 0) {
    return <p className="text-center text-muted-foreground">No lobbies</p>
  }
  return (
    <div className="space-y-4">
      {lobbies.map(lobby => (
        <LobbyItem key={lobby.id} lobby={lobby} />
      ))}
    </div>
  )
}

const LobbyTab = ({ mode }: { mode: 'blitz' | 'rapid' | 'async' }) => {
  const { lobbies } = useLobbySocket(mode)
  return <LobbyList lobbies={lobbies} />
}

export default function Lobby() {
  const [tab, setTab] = useState<'blitz' | 'rapid' | 'async'>('blitz')
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Lobby</h1>
      <Tabs value={tab} onValueChange={(v: 'blitz' | 'rapid' | 'async') => setTab(v)} className="w-full">
        <TabsList>
          <TabsTrigger value="blitz">Blitz</TabsTrigger>
          <TabsTrigger value="rapid">Rapid</TabsTrigger>
          <TabsTrigger value="async">Async</TabsTrigger>
        </TabsList>
        <TabsContent value="blitz">
          <LobbyTab mode="blitz" />
        </TabsContent>
        <TabsContent value="rapid">
          <LobbyTab mode="rapid" />
        </TabsContent>
        <TabsContent value="async">
          <LobbyTab mode="async" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
