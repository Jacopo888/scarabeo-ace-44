import { Home, Users, BookOpen } from "lucide-react"
import { useLocation } from "react-router-dom"
import { motion } from "framer-motion"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarBrand } from '@/components/sidebar/SidebarBrand'
import { SidebarNav } from '@/components/sidebar/SidebarNav'

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/dashboard", icon: Users },
  { title: "Dictionary", url: "/dictionary", icon: BookOpen },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname
  const collapsed = state === "collapsed"

  return (
    <motion.div
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', mass: 0.4 }}
    >
      <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
        <SidebarContent>
          <SidebarBrand collapsed={collapsed} />
          <SidebarNav items={items} collapsed={collapsed} />
        </SidebarContent>
      </Sidebar>
    </motion.div>
  )
}
