import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TableSkeletonProps {
  /** Number of rows to display */
  rows?: number
  /** Column configuration - either a number or array of widths */
  columns?: number | string[]
  /** Show table header skeleton */
  showHeader?: boolean
}

/**
 * Skeleton loader for tables
 *
 * @example
 * // Basic usage with 5 rows and 4 columns
 * <TableSkeleton rows={5} columns={4} />
 *
 * @example
 * // With custom column widths
 * <TableSkeleton rows={5} columns={['w-20', 'w-40', 'w-32', 'w-24']} />
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
}: TableSkeletonProps) {
  const columnCount = typeof columns === 'number' ? columns : columns.length
  const columnWidths = typeof columns === 'number'
    ? Array(columns).fill('w-full')
    : columns

  return (
    <div className="rounded-md border">
      <Table>
        {showHeader && (
          <TableHeader>
            <TableRow>
              {Array.from({ length: columnCount }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className={`h-4 ${columnWidths[i]}`} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columnCount }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton className={`h-4 ${columnWidths[colIndex]}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Skeleton loader for list cards (empty state placeholder)
 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  )
}

/**
 * Skeleton loader for list of cards
 */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
