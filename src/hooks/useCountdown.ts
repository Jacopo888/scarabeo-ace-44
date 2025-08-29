import { useState, useEffect, useRef } from 'react'

interface UseCountdownReturn {
  timeLeft: number
  isRunning: boolean
  start: (duration: number) => void
  stop: () => void
  reset: () => void
  formatTime: (seconds: number) => string
}

export function useCountdown(): UseCountdownReturn {
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const start = (duration: number) => {
    setTimeLeft(duration)
    setIsRunning(true)
  }

  const stop = () => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const reset = () => {
    stop()
    setTimeLeft(0)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, timeLeft])

  return {
    timeLeft,
    isRunning,
    start,
    stop,
    reset,
    formatTime
  }
}