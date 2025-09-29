import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X } from 'lucide-react'
import type { Notification } from './useNotifications'

type Props = {
  notifications: Notification[]
  unreadCount: number
  onClose: () => void
  onMarkAll: () => void
  onMarkOne: (id: string) => void
  onRemove: (id: string) => void
  getIcon: (type: Notification['type']) => string
}

export const NotificationPanel = ({ notifications, unreadCount, onClose, onMarkAll, onMarkOne, onRemove, getIcon }: Props) => (
  <Card className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto z-50 shadow-lg">
    <div className="p-4 border-b">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAll} className="text-xs">
              Mark all as read
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <div className="max-h-80 overflow-y-auto">
      {notifications.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">No notifications</div>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${!n.read ? 'bg-primary/5' : ''}`}
            onClick={() => onMarkOne(n.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{getIcon(n.type)}</span>
                  <p className="font-semibold text-sm">{n.title}</p>
                  {!n.read && <div className="w-2 h-2 bg-primary rounded-full" />}
                </div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{n.createdAt.toLocaleTimeString()}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(n.id)
                }}
                className="ml-2"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {n.gameId && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={(e) => {
                  e.stopPropagation()
                  window.location.href = `/multiplayer-game/${n.gameId}`
                }}
              >
                Go to game
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  </Card>
)
