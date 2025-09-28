import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type StatusLabel = "Waiting for second player" | "It's your turn" | "Opponent's turn"

export function MultiplayerHeader({ gameStatus }: { gameStatus: StatusLabel }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard">
          <Button variant="outline" size="sm">
            {/* Kept icon outside to avoid extra dependency here */}
            <span className="sr-only">Back</span>
            <span>Dashboard</span>
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Multiplayer Game</h1>
      </div>
      <Badge variant={/your|it's your/i.test(gameStatus) ? "default" : "secondary"}>{gameStatus}</Badge>
    </div>
  )
}
