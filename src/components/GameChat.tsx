import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ChatMessage {
  id: string
  game_id: string
  player_id: string
  player_name: string
  message: string
  created_at: string
}

interface GameChatProps {
  gameId: string
}

export const GameChat = ({ gameId }: GameChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMessages()
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`game_chat_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_chats',
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages(prev => [...prev, newMsg])
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  const fetchMessages = async () => {
    try {
      // Use direct query with any type to bypass type issues
      const { data, error } = await (supabase as any)
        .from('game_chats')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setMessages(data || [])
      setTimeout(scrollToBottom, 100)
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    try {
      setLoading(true)
      
      // Use direct insert with any type to bypass type issues
      const { error } = await (supabase as any)
        .from('game_chats')
        .insert({
          game_id: gameId,
          player_id: user.id,
          player_name: user.email?.split('@')[0] || 'Player',
          message: newMessage.trim()
        })

      if (error) throw error
      
      setNewMessage('')
      scrollToBottom()
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Unable to send message",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
    }, 100)
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card className="w-full h-80 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Game Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 p-3">
        <ScrollArea ref={scrollAreaRef} className="flex-1 pr-2">
          <div className="space-y-2">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`flex flex-col gap-1 ${
                  message.player_id === user?.id ? 'items-end' : 'items-start'
                }`}
              >
                <div 
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    message.player_id === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="font-medium text-xs opacity-70 mb-1">
                    {message.player_name}
                  </div>
                  <div>{message.message}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(message.created_at)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="sm" 
            disabled={loading || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}