import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface Notification {
  id: string
  type: 'game_found' | 'turn_reminder' | 'game_ended' | 'move_made'
  title: string
  message: string
  gameId?: string
  createdAt: Date
  read: boolean
}

export const NotificationSystem = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (!user) return

    // Set up real-time subscriptions for game events
    const gamesChannel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games'
        },
        (payload) => {
          const game = payload.new as any
          if (game.player1_id === user.id || game.player2_id === user.id) {
            addNotification({
              type: 'game_found',
              title: 'New Game!',
              message: 'A new game has been created. Good luck!',
              gameId: game.id
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games'
        },
        (payload) => {
          const game = payload.new as any

          if (game.player1_id === user.id || game.player2_id === user.id) {
            // Notify when it's the user's turn
            if (game.current_player_id === user.id) {
              addNotification({
                type: 'turn_reminder',
                title: "It's your turn!",
                message: 'You can make your move now',
                gameId: game.id
              })
            }

            // Notify when game ends
            if (game.status === 'completed') {
              const isWinner = game.winner_id === user.id
              addNotification({
                type: 'game_ended',
                title: isWinner ? 'You won!' : 'Game ended',
                message: isWinner ? 'Congratulations on the win!' : 'The game has finished',
                gameId: game.id
              })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moves'
        },
        (payload) => {
          const move = payload.new as any
          // Only notify if it's not the user's own move
          if (move.player_id !== user.id) {
            // Check if this move is in a game the user is playing
            checkIfUserGame(move.game_id).then(isUserGame => {
              if (isUserGame) {
                addNotification({
                  type: 'move_made',
                  title: "Opponent's move",
                  message: 'Your opponent made a move',
                  gameId: move.game_id
                })
              }
            })
          }
        }
      )
      .subscribe()

    // Check for turn deadlines
    const checkTurnDeadlines = () => {
      if (!user) return
      
      supabase
        .from('games')
        .select('*')
        .eq('current_player_id', user.id)
        .eq('status', 'active')
        .then(({ data: games }) => {
          if (!games) return
          
          games.forEach(game => {
            if (game.turn_deadline) {
              const deadline = new Date(game.turn_deadline)
              const now = new Date()
              const timeLeft = deadline.getTime() - now.getTime()
              
              // Notify 1 hour before deadline
              if (timeLeft > 0 && timeLeft <= 60 * 60 * 1000) {
                addNotification({
                  type: 'turn_reminder',
                  title: 'Turn reminder',
                  message: 'Your turn expires in less than an hour!',
                  gameId: game.id
                })
              }
            }
          })
        })
    }

    // Check deadlines every 10 minutes
    const deadlineInterval = setInterval(checkTurnDeadlines, 10 * 60 * 1000)
    checkTurnDeadlines() // Check immediately

    return () => {
      supabase.removeChannel(gamesChannel)
      clearInterval(deadlineInterval)
    }
  }, [user])

  const checkIfUserGame = async (gameId: string): Promise<boolean> => {
    if (!user) return false
    
    const { data } = await supabase
      .from('games')
      .select('player1_id, player2_id')
      .eq('id', gameId)
      .single()
    
    return data?.player1_id === user.id || data?.player2_id === user.id
  }

  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      createdAt: new Date(),
      read: false
    }

    setNotifications(prev => [newNotification, ...prev].slice(0, 20)) // Keep only last 20

    // Show toast for important notifications
    if (notification.type === 'game_found' || notification.type === 'turn_reminder') {
      toast({
        title: notification.title,
        description: notification.message
      })
    }
  }

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'game_found': return '🎮'
      case 'turn_reminder': return '⏰'
      case 'game_ended': return '🏆'
      case 'move_made': return '♟️'
      default: return '📢'
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setShowPanel(!showPanel)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {showPanel && (
        <Card className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto z-50 shadow-lg">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    Mark all as read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPanel(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                        <p className="font-semibold text-sm">{notification.title}</p>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.createdAt.toLocaleTimeString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeNotification(notification.id)
                      }}
                      className="ml-2"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {notification.gameId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => {
                        window.location.href = `/multiplayer-game/${notification.gameId}`
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
      )}
    </div>
  )
}