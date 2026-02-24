import {
  Home,
  Building2,
  FolderKanban,
  Clock,
  Receipt,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  labelKey: string // Translation key (e.g., 'dashboard' -> nav.dashboard)
  icon: LucideIcon
  permission: string | null // null = visible to all authenticated users
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: Home, labelKey: 'dashboard', permission: null },
  { href: '/clients', icon: Building2, labelKey: 'clients', permission: 'clients.view' },
  { href: '/projects', icon: FolderKanban, labelKey: 'projects', permission: 'projects.view' },
  { href: '/timesheets', icon: Clock, labelKey: 'timesheets', permission: 'timesheets.view_own' },
  { href: '/expenses', icon: Receipt, labelKey: 'expenses', permission: 'expenses.view_own' },
  { href: '/invoices', icon: FileText, labelKey: 'invoices', permission: 'invoices.view' },
  { href: '/reports', icon: BarChart3, labelKey: 'reports', permission: null },
  { href: '/admin', icon: Settings, labelKey: 'admin', permission: 'admin.users' },
]

/**
 * Filter navigation items based on user permissions
 */
export function filterNavByPermissions(items: NavItem[], permissions: string[]): NavItem[] {
  return items.filter(item =>
    item.permission === null || permissions.includes(item.permission)
  )
}
