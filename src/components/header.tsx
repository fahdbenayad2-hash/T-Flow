import { Link } from '@tanstack/react-router'
import { Bell, Search, Menu, X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { useNotifications } from '~/hooks/useNotifications'
import { NotificationBell } from '~/components/notification-bell'
import { useState } from 'react'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <div className="flex-1">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
      </div>
    </header>
  )
}
