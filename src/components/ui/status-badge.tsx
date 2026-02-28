'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Status colors using semantic CSS custom properties
 * These map to --status-* variables defined in globals.css
 * which support both light and dark mode automatically
 */
const statusColors = {
  // Neutral states (gray)
  draft: 'bg-status-neutral-muted text-status-neutral-foreground border-status-neutral-muted',
  inactive: 'bg-status-neutral-muted text-status-neutral-foreground border-status-neutral-muted',
  void: 'bg-status-neutral-muted text-status-neutral-foreground border-status-neutral-muted',
  not_started: 'bg-status-neutral-muted text-status-neutral-foreground border-status-neutral-muted',

  // Success states (green)
  active: 'bg-status-success-muted text-status-success-foreground border-status-success-muted',
  approved: 'bg-status-success-muted text-status-success-foreground border-status-success-muted',
  paid: 'bg-status-success-muted text-status-success-foreground border-status-success-muted',
  delivered: 'bg-status-success-muted text-status-success-foreground border-status-success-muted',

  // Warning states (yellow/orange)
  on_hold: 'bg-status-warning-muted text-status-warning-foreground border-status-warning-muted',
  pending: 'bg-status-warning-muted text-status-warning-foreground border-status-warning-muted',

  // Info states (blue)
  completed: 'bg-status-info-muted text-status-info-foreground border-status-info-muted',
  submitted: 'bg-status-info-muted text-status-info-foreground border-status-info-muted',
  sent: 'bg-status-info-muted text-status-info-foreground border-status-info-muted',

  // Error states (red)
  cancelled: 'bg-status-error-muted text-status-error-foreground border-status-error-muted',
  rejected: 'bg-status-error-muted text-status-error-foreground border-status-error-muted',
  bounced: 'bg-status-error-muted text-status-error-foreground border-status-error-muted',
  failed: 'bg-status-error-muted text-status-error-foreground border-status-error-muted',

  // Special states (purple)
  locked: 'bg-status-purple-muted text-status-purple-foreground border-status-purple-muted',
} as const

type StatusType = keyof typeof statusColors

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations('common.status')

  return (
    <Badge variant="outline" className={cn(statusColors[status], className)}>
      {t(status)}
    </Badge>
  )
}
