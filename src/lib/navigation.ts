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
  label: string
  icon: LucideIcon
  permission: string | null // null = visible to all authenticated users
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'Dashboard', permission: null },
  { href: '/clients', icon: Building2, label: 'Clients', permission: 'clients.view' },
  { href: '/projects', icon: FolderKanban, label: 'Projects', permission: 'projects.view' },
  { href: '/timesheets', icon: Clock, label: 'Timesheets', permission: 'timesheets.view_own' },
  { href: '/expenses', icon: Receipt, label: 'Expenses', permission: 'expenses.view_own' },
  { href: '/invoices', icon: FileText, label: 'Invoices', permission: 'invoices.view' },
  { href: '/reports', icon: BarChart3, label: 'Reports', permission: null }, // No reports permission defined yet
  { href: '/admin', icon: Settings, label: 'Admin', permission: 'admin.users' },
]

/**
 * Filter navigation items based on user permissions
 */
export function filterNavByPermissions(items: NavItem[], permissions: string[]): NavItem[] {
  return items.filter(item =>
    item.permission === null || permissions.includes(item.permission)
  )
}
