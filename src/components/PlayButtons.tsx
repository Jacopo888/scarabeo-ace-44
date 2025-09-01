import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Bot, Play, Zap, Calendar, Trophy } from "lucide-react"
import { useState } from "react"
import { DifficultyModal, Difficulty } from "@/components/DifficultyModal"
import { useNavigate } from "react-router-dom"
import { useQuackleContext } from "@/contexts/QuackleContext"
import { useAuth } from "@/contexts/AuthContext"
import { QuackleServiceStatus } from "@/components/QuackleServiceStatus"

export const PlayButtons = () => {
  const [showDifficultyModal, setShowDifficultyModal] = useState(false)
  const navigate = useNavigate()
  const { setDifficulty } = useQuackleContext()
  const { user } = useAuth()
  
  const handleBotPlay = () => {
    setShowDifficultyModal(true)
  }
  
  const handleDifficultySelect = (difficulty: Difficulty) => {
    console.log('[PlayButtons] Setting difficulty:', difficulty)
    setDifficulty(difficulty)
    // Navigate immediately - useEffect in useGame will handle initialization
    navigate('/game')
  }
  
  const handleQuickMatch = () => {
    if (!user) {
      navigate('/auth')
      return
    }
    navigate('/game')
  }
  
  return (
    <>
      <DifficultyModal 
        open={showDifficultyModal}
        onOpenChange={setShowDifficultyModal}
        onSelectDifficulty={handleDifficultySelect}
      />
      <div className="space-y-6">
        {/* Puzzle Modes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="text-center">
              <Zap className="h-12 w-12 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>90s Puzzle</CardTitle>
              <CardDescription>
                Watch the puzzle build progressively, then find the best move in 90 seconds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/puzzle?90s=true')}>
                Start 90s Challenge
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="text-center">
              <Trophy className="h-12 w-12 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Daily Puzzle</CardTitle>
              <CardDescription>
                Complete today's puzzle and compare your score
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/daily')}>
                Today's Challenge
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="text-center">
              <Play className="h-12 w-12 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Random Puzzle</CardTitle>
              <CardDescription>
                Practice with unlimited random puzzles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/puzzle')}>
                Random Puzzle
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Game Modes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="text-center">
              <Users className="h-12 w-12 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Play Online</CardTitle>
              <CardDescription>
                Challenge players around the world in async matches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={handleQuickMatch}>
                Find Match
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="text-center">
              <Play className="h-12 w-12 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Play Local</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => { setDifficulty(null); navigate('/game') }}>
                Start
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="text-center">
              <Bot className="h-12 w-12 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle className="flex items-center justify-center gap-2">
                Play vs Quackle
                <QuackleServiceStatus />
              </CardTitle>
              <CardDescription>
                Challenge the powerful Quackle AI engine
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={handleBotPlay}>
                Choose Difficulty
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}