'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, filterNavByPermissions } from '@/lib/navigation'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  permissions: string[]
}

export function MobileNav({ open, onOpenChange, permissions }: MobileNavProps) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const filteredItems = filterNavByPermissions(NAV_ITEMS, permissions)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm text-primary-foreground font-bold">GC</span>
            </div>
            Grand Canyon
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {filteredItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
