'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserMenu } from './user-menu'
import type { ProfileWithRole } from '@/lib/auth'

interface TopBarProps {
  profile: ProfileWithRole
  onMobileMenuToggle?: () => void
}

export function TopBar({ profile, onMobileMenuToggle }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-sm text-primary-foreground font-bold">GC</span>
        </div>
        <span className="font-semibold hidden sm:inline-block">Grand Canyon</span>
      </div>

      <div className="flex-1" />

      <UserMenu profile={profile} />
    </header>
  )
}
