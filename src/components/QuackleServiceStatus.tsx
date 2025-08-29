import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { quackleHealth } from '@/services/quackleClient'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

export const QuackleServiceStatus = () => {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'unhealthy'>('checking')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isHealthy = await quackleHealth()
        setStatus(isHealthy ? 'healthy' : 'unhealthy')
      } catch (error) {
        setStatus('unhealthy')
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 30000) // Check every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

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