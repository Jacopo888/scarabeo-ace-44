import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { quackleHealth } from '@/services/quackleClient'
import { checkLexiconHealth } from '@/config'
import { AlertTriangle, CheckCircle } from 'lucide-react'

export const QuackleHealthCheck = () => {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null)
  const [lexOk, setLexOk] = useState<boolean | null>(null)
  const [lexMsg, setLexMsg] = useState<string>('')
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkHealth = async () => {
      setIsChecking(true)
      try {
        const healthy = await quackleHealth()
        setIsHealthy(healthy.ok)
        const lex = await checkLexiconHealth()
        setLexOk(!!lex.ok)
        if (!lex.ok) {
          setLexMsg(JSON.stringify(lex.data))
        } else {
          setLexMsg('')
        }
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

  if (isHealthy === false || lexOk === false) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Quackle AI engine is not available or lexicon missing. {lexMsg && `Details: ${lexMsg}`}
        </AlertDescription>
      </Alert>
    )
  }

  if (isHealthy === true) {
    return (
      <Alert className="mb-4 border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-700">
          Quackle AI engine is ready! {lexOk ? 'Lexicon OK.' : ''}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
