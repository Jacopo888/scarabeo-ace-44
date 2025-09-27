import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { quackleHealth, quackleCors, quackleLexiconHealth } from '@/services/quackleClient'
import { AlertTriangle, CheckCircle } from 'lucide-react'

export const QuackleHealthCheck = () => {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null)
  const [corsOrigins, setCorsOrigins] = useState<string[] | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [lexOk, setLexOk] = useState<boolean | null>(null)

  useEffect(() => {
    const checkHealth = async () => {
      setIsChecking(true)
      try {
        const healthy = await quackleHealth()
        setIsHealthy(healthy.ok)
        const cors = await quackleCors()
        setCorsOrigins(cors.allow_origins)
        const lex = await quackleLexiconHealth()
        setLexOk(lex.ok)
      } catch (error) {
        setIsHealthy(false)
        setLexOk(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkHealth()
    
    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isChecking) return null

  if (isHealthy === false) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Quackle AI engine is not available. Check network/CORS and service logs.
        </AlertDescription>
      </Alert>
    )
  }

  // Healthy: no UI banner to keep pages clean
  if (isHealthy === true) return null

  return null
}
