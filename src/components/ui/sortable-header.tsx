'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SortDirection } from '@/hooks/use-sort'

interface SortableHeaderProps {
  /** Column key used for sorting */
  column: string
  /** Display label */
  label: string
  /** Whether this column is currently sorted */
  isSorted?: boolean
  /** Current sort direction if sorted */
  direction?: SortDirection | null
  /** Click handler */
  onClick?: () => void
  /** Additional class names */
  className?: string
  /** Whether sorting is disabled */
  disabled?: boolean
}

/**
 * Clickable table header with sort indicator
 *
 * @example
 * <SortableHeader
 *   column="name"
 *   label="Name"
 *   isSorted={isSorted('name')}
 *   direction={getSortDirection('name')}
 *   onClick={() => handleSort('name')}
 * />
 */
export function SortableHeader({
  column,
  label,
  isSorted = false,
  direction,
  onClick,
  className,
  disabled = false,
}: SortableHeaderProps) {
  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none hover:bg-muted/50 transition-colors',
        disabled && 'cursor-default hover:bg-transparent',
        className
      )}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {!disabled && (
          <span className="ml-1 flex-shrink-0">
            {isSorted ? (
              direction === 'asc' ? (
                <ArrowUp className="h-4 w-4 text-foreground" />
              ) : (
                <ArrowDown className="h-4 w-4 text-foreground" />
              )
            ) : (
              <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />
            )}
          </span>
        )}
      </div>
    </TableHead>
  )
}
