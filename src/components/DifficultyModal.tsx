import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bot, Star } from "lucide-react"

export type Difficulty = 'easy' | 'medium' | 'hard'

interface DifficultyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectDifficulty: (difficulty: Difficulty) => void
}

const difficultyOptions = [
  {
    id: 'easy' as const,
    name: 'Easy',
    stars: 1,
    color: 'bg-green-500'
  },
  {
    id: 'medium' as const,
    name: 'Medium',
    stars: 3,
    color: 'bg-yellow-500'
  },
  {
    id: 'hard' as const,
    name: 'Hard',
    stars: 5,
    color: 'bg-red-500'
  }
]

export const DifficultyModal = ({ open, onOpenChange, onSelectDifficulty }: DifficultyModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Choose Bot Difficulty
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {difficultyOptions.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className="w-full p-4 h-auto text-left"
              onClick={() => {
                onSelectDifficulty(option.id)
                onOpenChange(false)
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-3 h-3 rounded-full ${option.color} mt-1.5`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{option.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: option.stars }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current" />
                        ))}
                      </div>
                    </Badge>
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}