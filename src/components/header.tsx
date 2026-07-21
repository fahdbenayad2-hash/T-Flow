import { Bell, Menu, X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { NotificationBell } from '~/components/notification-bell'
import { useState } from 'react'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-surface-0/80 backdrop-blur-xl px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-8 w-8"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      <div className="flex-1">
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5">
        <NotificationBell />
      </div>
    </header>
  )
}
