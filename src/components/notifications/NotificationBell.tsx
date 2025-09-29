import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'

type Props = { unreadCount: number; onClick: () => void }

export const NotificationBell = ({ unreadCount, onClick }: Props) => (
  <Button variant="ghost" size="sm" className="relative" onClick={onClick}>
    <Bell className="h-5 w-5" />
    {unreadCount > 0 && (
      <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
        {unreadCount > 9 ? '9+' : unreadCount}
      </Badge>
    )}
  </Button>
)
