import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function ActionsCard({ isActive, onSurrender }: { isActive: boolean; onSurrender: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link to="/dashboard">
          <Button variant="outline" className="w-full">Back to Dashboard</Button>
        </Link>
        <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
          Refresh Game
        </Button>
        {isActive && (
          <Button variant="destructive" className="w-full" onClick={onSurrender}>
            Surrender
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
