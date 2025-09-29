import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { useQuackleHealth } from '@/hooks/useQuackleHealth'

export const QuackleHealthCheck = () => {
  const status = useQuackleHealth(30000)

  if (status === 'unhealthy') {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Quackle AI engine is not available. Check network/CORS and service logs.
        </AlertDescription>
      </Alert>
    )
  }
  return null
}
