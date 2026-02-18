import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusColors = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  on_hold: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  void: 'bg-gray-100 text-gray-700 border-gray-200',
  locked: 'bg-purple-100 text-purple-700 border-purple-200',
} as const

type StatusType = keyof typeof statusColors

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = status.replace(/_/g, ' ')

  return (
    <Badge variant="outline" className={cn(statusColors[status], 'capitalize', className)}>
      {label}
    </Badge>
  )
}
