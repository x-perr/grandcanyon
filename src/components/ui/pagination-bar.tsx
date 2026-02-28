'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaginationBarProps {
  /** Current page number (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Total number of items */
  totalCount: number
  /** Current page size */
  pageSize: number
  /** Available page size options */
  pageSizeOptions?: number[]
  /** Callback when page changes */
  onPageChange: (page: number) => void
  /** Callback when page size changes */
  onPageSizeChange?: (size: number) => void
  /** Whether navigation is pending */
  isPending?: boolean
  /** Show page size selector */
  showPageSize?: boolean
}

/**
 * Reusable pagination bar with page navigation and optional page size selector.
 *
 * @example
 * <PaginationBar
 *   currentPage={currentPage}
 *   totalPages={totalPages}
 *   totalCount={totalCount}
 *   pageSize={pageSize}
 *   onPageChange={goToPage}
 *   onPageSizeChange={setPageSize}
 *   isPending={isPending}
 * />
 */
export function PaginationBar({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions = [20, 50, 100],
  onPageChange,
  onPageSizeChange,
  isPending = false,
  showPageSize = true,
}: PaginationBarProps) {
  const t = useTranslations('common')

  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalCount)
  const hasPrevious = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Item count */}
      <p className="text-sm text-muted-foreground">
        {t('pagination.showing', {
          start: startIndex,
          end: endIndex,
          total: totalCount,
        })}
      </p>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {t('pagination.rows_per_page')}:
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Page navigation */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPrevious || isPending}
          >
            {t('actions.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNext || isPending}
          >
            {t('actions.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
