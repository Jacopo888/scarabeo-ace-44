import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

type Props = {
  onPlayVsBot: () => void
}

export function QuickActionsCard({ onPlayVsBot }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" className="w-full" onClick={onPlayVsBot}>
          Play vs Bot
        </Button>
        <Link to="/dictionary">
          <Button variant="outline" className="w-full">
            Dictionary
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
