import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useMatchmaking } from '@/hooks/useMatchmaking'
import { useToast } from '@/hooks/use-toast'
import { DifficultyModal, Difficulty } from '@/components/DifficultyModal'
import { useQuackleContext } from '@/contexts/QuackleContext'
import { useActiveGames } from '@/hooks/useActiveGames'
import { ProfileStats } from '@/components/dashboard/ProfileStats'
import { MatchmakingCard } from '@/components/dashboard/MatchmakingCard'
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard'
import { ActiveGamesList } from '@/components/dashboard/ActiveGamesList'

export default function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const { isInQueue, loading, joinQueue, leaveQueue } = useMatchmaking()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { setDifficulty } = useQuackleContext()
  const [showDiffModal, setShowDiffModal] = useState(false)
  const { activeGames } = useActiveGames(user?.id, (msg) =>
    toast({ title: 'Error', description: msg, variant: 'destructive' })
  )

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
        <DifficultyModal
          open={showDiffModal}
          onOpenChange={setShowDiffModal}
          onSelectDifficulty={(d: Difficulty) => {
            setDifficulty(d)
            navigate(`/game?mode=quackle&difficulty=${d}`)
          }}
        />
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {profile.display_name || profile.username}!</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/game?mode=local">
              <Button variant="outline">Local Game</Button>
            </Link>
            <Button variant="outline" onClick={signOut}>Logout</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ProfileStats gamesPlayed={profile.games_played} gamesWon={profile.games_won} skillLevel={profile.skill_level} />
          <MatchmakingCard
            isInQueue={isInQueue}
            loading={loading}
            onJoin={(duration) => joinQueue(duration)}
            onLeave={leaveQueue}
          />
          <QuickActionsCard onPlayVsBot={() => setShowDiffModal(true)} />
        </div>

        <ActiveGamesList userId={user.id} games={activeGames} />
      </div>
    </div>
  )
}