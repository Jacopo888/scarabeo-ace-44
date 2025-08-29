import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Bot, Play } from "lucide-react"
import { useState } from "react"
import { DifficultyModal, Difficulty } from "@/components/DifficultyModal"
import { useNavigate } from "react-router-dom"
import { useBotContext } from "@/contexts/BotContext"
import { useAuth } from "@/contexts/AuthContext"

export const PlayButtons = () => {
  const [showDifficultyModal, setShowDifficultyModal] = useState(false)
  const navigate = useNavigate()
  const { setDifficulty } = useBotContext()
  const { user } = useAuth()
  
  const handleBotPlay = () => {
    setShowDifficultyModal(true)
  }
  
  const handleDifficultySelect = (difficulty: Difficulty) => {
    setDifficulty(difficulty)
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
              <CardTitle>Play vs Computer</CardTitle>
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