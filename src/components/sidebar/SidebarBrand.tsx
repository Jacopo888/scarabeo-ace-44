import { useMemo } from 'react'

export function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const title = useMemo(() => collapsed ? 'S' : 'Scrabble Online', [collapsed])
  return (
    <div className="p-4 border-b border-sidebar-border">
      <h1 className={`font-bold ${collapsed ? 'text-center text-sm' : 'text-xl'}`}>
        {title}
      </h1>
    </div>
  )
}
