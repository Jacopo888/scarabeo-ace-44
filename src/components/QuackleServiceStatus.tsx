import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useQuackleHealth } from '@/hooks/useQuackleHealth'

export const QuackleServiceStatus = () => {
  const { status } = useQuackleHealth(30000)

  if (status === 'checking') {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking Quackle...
      </Badge>
    )
  }

  if (status === 'healthy') {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Quackle Ready
      </Badge>
    )
  }

  return (
    <Badge variant="destructive" className="flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />
      Quackle Offline
    </Badge>
  )
}