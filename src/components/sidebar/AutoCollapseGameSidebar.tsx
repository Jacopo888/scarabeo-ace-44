import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useSidebar } from '@/components/ui/sidebar'

export function shouldAutoCollapseSidebar(pathname: string): boolean {
  return pathname === '/game' || pathname.startsWith('/multiplayer-game/')
}

export function AutoCollapseGameSidebar() {
  const location = useLocation()
  const { setOpen, setOpenMobile } = useSidebar()
  const controlsRef = useRef({ setOpen, setOpenMobile })

  useEffect(() => {
    controlsRef.current = { setOpen, setOpenMobile }
  }, [setOpen, setOpenMobile])

  useEffect(() => {
    if (!shouldAutoCollapseSidebar(location.pathname)) return

    controlsRef.current.setOpen(false)
    controlsRef.current.setOpenMobile(false)
  }, [location.pathname])

  return null
}
