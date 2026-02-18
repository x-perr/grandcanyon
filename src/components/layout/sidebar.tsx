'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, filterNavByPermissions } from '@/lib/navigation'

interface SidebarProps {
  permissions: string[]
}

export function Sidebar({ permissions }: SidebarProps) {
  const pathname = usePathname()
  const filteredItems = filterNavByPermissions(NAV_ITEMS, permissions)

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r bg-muted/40">
      <nav className="flex flex-col gap-1 p-4">
        {filteredItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
