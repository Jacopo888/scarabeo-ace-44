import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useMatchmaking } from '@/hooks/useMatchmaking'
import { GameRecord } from '@/types/multiplayer'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Clock, Trophy, Users, Target } from 'lucide-react'

export default function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const { isInQueue, loading, joinQueue, leaveQueue } = useMatchmaking()
  const [activeGames, setActiveGames] = useState<GameRecord[]>([])
  const [preferredDuration, setPreferredDuration] = useState<'1h' | '6h' | '24h' | '48h'>('24h')
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchActiveGames()
    }
  }, [user])

  // Set up real-time subscription for games
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('dashboard-games')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `player1_id=eq.${user.id},player2_id=eq.${user.id}`
        },
        () => {
          fetchActiveGames()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchActiveGames = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          *,
          player1:profiles!games_player1_id_fkey(username, display_name),
          player2:profiles!games_player2_id_fkey(username, display_name)
        `)
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .in('status', ['active', 'waiting'])
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      setActiveGames(data as any)
    } catch (error) {
      console.error('Error fetching games:', error)
      toast({
        title: 'Error',
        description: 'Unable to load games',
        variant: 'destructive'
      })
    }
  }

  const handleJoinQueue = () => {
    joinQueue(preferredDuration)
  }

  const getGameStatus = (game: GameRecord) => {
    if (game.status === 'waiting') return 'In attesa'
    if (game.current_player_id === user?.id) return 'Il tuo turno'
    return 'Turno avversario'
  }

  const getStatusColor = (game: GameRecord) => {
    if (game.status === 'waiting') return 'secondary'
    if (game.current_player_id === user?.id) return 'default'
    return 'outline'
  }

  const getOpponentName = (game: any) => {
    const isPlayer1 = game.player1_id === user?.id
    const opponent = isPlayer1 ? game.player2 : game.player1
    return opponent?.display_name || opponent?.username || 'Opponent'
  }

  const getMyScore = (game: GameRecord) => {
    return game.player1_id === user?.id ? game.player1_score : game.player2_score
  }

  const getOpponentScore = (game: GameRecord) => {
    return game.player1_id === user?.id ? game.player2_score : game.player1_score
  }

  const formatTimeRemaining = (deadline: string) => {
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diff = deadlineDate.getTime() - now.getTime()
    
    if (diff <= 0) return 'Scaduto'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication required</h1>
          <Link to="/auth">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {profile.display_name || profile.username}!</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/game">
              <Button variant="outline">Local Game</Button>
            </Link>
            <Button variant="outline" onClick={signOut}>Logout</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Games played:</span>
                <span className="font-semibold">{profile.games_played}</span>
              </div>
              <div className="flex justify-between">
                <span>Games won:</span>
                <span className="font-semibold">{profile.games_won}</span>
              </div>
              <div className="flex justify-between">
                <span>Win rate:</span>
                <span className="font-semibold">
                  {profile.games_played > 0 
                    ? Math.round((profile.games_won / profile.games_played) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Skill level:</span>
                <span className="font-semibold">{profile.skill_level}</span>
              </div>
            </CardContent>
          </Card>

          {/* Matchmaking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Matchmaking
              </CardTitle>
              <CardDescription>
                Find an opponent for a new match
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isInQueue ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preferred turn duration:</label>
                    <Select value={preferredDuration} onValueChange={(value) => setPreferredDuration(value as '1h' | '6h' | '24h' | '48h')}>
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
                  <Button 
                    onClick={handleJoinQueue} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Searching...' : 'Find Match'}
                  </Button>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Target className="h-5 w-5 animate-pulse" />
                    <span>In matchmaking queue...</span>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={leaveQueue}
                    disabled={loading}
                    className="w-full"
                  >
                    Leave queue
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/game">
                <Button variant="outline" className="w-full">
                  Play vs Bot
                </Button>
              </Link>
              <Link to="/dictionary">
                <Button variant="outline" className="w-full">
                  Dictionary
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Active Games */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Active Games ({activeGames.length})
            </CardTitle>
            <CardDescription>
              Your ongoing games
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeGames.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No active games. Start a new one via matchmaking!
              </p>
            ) : (
              <div className="space-y-4">
                {activeGames.map((game) => (
                  <div key={game.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">vs {getOpponentName(game)}</h3>
                        <p className="text-sm text-muted-foreground">
                          Created: {new Date(game.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={getStatusColor(game)}>
                        {getGameStatus(game)}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm">
                        You: <span className="font-semibold">{getMyScore(game)}</span> -
                        Opponent: <span className="font-semibold">{getOpponentScore(game)}</span>
                      </div>
                      {game.turn_deadline && (
                        <div className="text-sm text-muted-foreground">
                          Expires: {formatTimeRemaining(game.turn_deadline)}
                        </div>
                      )}
                    </div>
                    
                    <Link to={`/multiplayer-game/${game.id}`}>
                      <Button size="sm">
                        {game.current_player_id === user.id ? 'Play your turn' : 'View game'}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}