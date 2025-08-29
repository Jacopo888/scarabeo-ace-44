import { useState } from "react"
import { Home, Play, Users, BarChart3, Settings, Trophy, BookOpen, Zap } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { motion } from "framer-motion"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Puzzle 90s", url: "/puzzle", icon: Zap },
  { title: "Daily", url: "/daily-challenge", icon: Trophy },
  { title: "Dashboard", url: "/dashboard", icon: Users },
  { title: "Dictionary", url: "/dictionary", icon: BookOpen },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname
  const collapsed = state === "collapsed"

  const isActive = (path: string) => currentPath === path
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-primary rounded-xl" : "hover:bg-white/5 rounded-xl"

  return (
    <motion.div
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', mass: 0.4 }}
    >
      <Sidebar
        className={collapsed ? "w-14" : "w-60"}
        collapsible="icon"
      >
      <SidebarContent>
        <div className="p-4 border-b border-sidebar-border">
          <h1 className={`font-bold ${collapsed ? "text-center text-sm" : "text-xl"}`}>
            {collapsed ? "S" : "Scrabble Online"}
          </h1>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Main Menu
          </SidebarGroupLabel>
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
      </SidebarContent>
    </Sidebar>
    </motion.div>
  )
}