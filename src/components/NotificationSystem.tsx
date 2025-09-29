import { useState } from 'react'
import { NotificationBell } from './notifications/NotificationBell'
import { NotificationPanel } from './notifications/NotificationPanel'
import { useNotifications } from './notifications/useNotifications'

export const NotificationSystem = () => {
  const [showPanel, setShowPanel] = useState(false)
  const { notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification, getNotificationIcon } = useNotifications()

  return (
    <div className="relative">
      <NotificationBell unreadCount={unreadCount} onClick={() => setShowPanel(!showPanel)} />

      {showPanel && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          onClose={() => setShowPanel(false)}
          onMarkAll={markAllAsRead}
          onMarkOne={markAsRead}
          onRemove={removeNotification}
          getIcon={getNotificationIcon}
        />
      )}
    </div>
  )
}