import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export type Notification = {
  id: string
  type: 'game_found' | 'turn_reminder' | 'game_ended' | 'move_made'
  title: string
  message: string
  gameId?: string
  createdAt: Date
  read: boolean
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const { user } = useAuth()
  const { toast } = useToast()

  // derived
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      createdAt: new Date(),
      read: false,
    }
    setNotifications(prev => [newNotification, ...prev].slice(0, 20))

    if (notification.type === 'game_found' || notification.type === 'turn_reminder') {
      toast({ title: notification.title, description: notification.message })
    }
  }, [toast])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const checkIfUserGame = useCallback(async (gameId: string): Promise<boolean> => {
    if (!user) return false
    const { data } = await supabase
      .from('games')
      .select('player1_id, player2_id')
      .eq('id', gameId)
      .single()
    return data?.player1_id === user.id || data?.player2_id === user.id
  }, [user])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, (payload) => {
        const game = payload.new as any
        if (game.player1_id === user.id || game.player2_id === user.id) {
          addNotification({ type: 'game_found', title: 'New Game!', message: 'A new game has been created. Good luck!', gameId: game.id })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, (payload) => {
        const game = payload.new as any
        if (game.player1_id === user.id || game.player2_id === user.id) {
          if (game.current_player_id === user.id) {
            addNotification({ type: 'turn_reminder', title: "It's your turn!", message: 'You can make your move now', gameId: game.id })
          }
          if (game.status === 'completed') {
            const isWinner = game.winner_id === user.id
            addNotification({ type: 'game_ended', title: isWinner ? 'You won!' : 'Game ended', message: isWinner ? 'Congratulations on the win!' : 'The game has finished', gameId: game.id })
          }
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves' }, (payload) => {
        const move = payload.new as any
        if (move.player_id !== user.id) {
          checkIfUserGame(move.game_id).then((isUserGame) => {
            if (isUserGame) {
              const words = Array.isArray(move.words_formed) ? move.words_formed.filter((w: any) => typeof w === 'string') : []
              const wordsPart = words.length > 0 ? `: ${words.join(', ')}` : ''
              const scorePart = typeof move.score_earned === 'number' ? ` (+${move.score_earned})` : ''
              const title = "Mossa dell'avversario"
              const message = `L'avversario ha giocato${wordsPart}${scorePart}`
              addNotification({ type: 'move_made', title, message, gameId: move.game_id })
              toast({ title, description: message })
            }
          })
        }
      })
      .subscribe()

    const checkTurnDeadlines = () => {
      if (!user) return
      supabase
        .from('games')
        .select('*')
        .eq('current_player_id', user.id)
        .eq('status', 'active')
        .then(({ data: games }) => {
          if (!games) return
          games.forEach((game: any) => {
            if (game.turn_deadline) {
              const deadline = new Date(game.turn_deadline)
              const now = new Date()
              const timeLeft = deadline.getTime() - now.getTime()
              if (timeLeft > 0 && timeLeft <= 60 * 60 * 1000) {
                addNotification({ type: 'turn_reminder', title: 'Turn reminder', message: 'Your turn expires in less than an hour!', gameId: game.id })
              }
            }
          })
        })
    }

    const interval = setInterval(checkTurnDeadlines, 10 * 60 * 1000)
    checkTurnDeadlines()
    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [user, addNotification, checkIfUserGame, toast])

  const getNotificationIcon = useCallback((type: Notification['type']) => {
    switch (type) {
      case 'game_found':
        return '🎮'
      case 'turn_reminder':
        return '⏰'
      case 'game_ended':
        return '🏆'
      case 'move_made':
        return '♟️'
      default:
        return '📢'
    }
  }, [])

  return { notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification, getNotificationIcon }
}
