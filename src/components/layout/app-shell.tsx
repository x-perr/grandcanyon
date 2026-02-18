'use client'

import { useState } from 'react'
import { TopBar } from './top-bar'
import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'
import type { ProfileWithRole } from '@/lib/auth'

interface AppShellProps {
  children: React.ReactNode
  profile: ProfileWithRole
  permissions: string[]
}

export function AppShell({ children, profile, permissions }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        profile={profile}
        onMobileMenuToggle={() => setMobileNavOpen(true)}
      />

      <div className="flex flex-1">
        <Sidebar permissions={permissions} />

        <MobileNav
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          permissions={permissions}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
