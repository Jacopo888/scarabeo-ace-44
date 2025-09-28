import { NavLink } from 'react-router-dom'
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import type { ComponentType } from 'react'

export interface NavItem { title: string; url: string; icon: ComponentType<{ className?: string }> }

export function SidebarNav({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-sidebar-accent text-sidebar-primary rounded-xl' : 'hover:bg-white/5 rounded-xl'

  return (
    <SidebarGroup>
      <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>Main Menu</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} end className={getNavCls}>
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="rounded-xl">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
