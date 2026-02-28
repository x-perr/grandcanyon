'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export type SortDirection = 'asc' | 'desc'

interface UseSortOptions {
  /** Base path for URL updates (e.g., '/clients') */
  basePath: string
  /** Default sort column */
  defaultColumn?: string
  /** Default sort direction */
  defaultDirection?: SortDirection
}

interface UseSortReturn {
  /** Current sort column */
  sortColumn: string | null
  /** Current sort direction */
  sortDirection: SortDirection
  /** Handle column sort click */
  handleSort: (column: string) => void
  /** Whether a sort transition is pending */
  isPending: boolean
  /** Check if a column is currently sorted */
  isSorted: (column: string) => boolean
  /** Get sort direction for a column */
  getSortDirection: (column: string) => SortDirection | null
}

/**
 * Hook for URL-based column sorting
 *
 * @example
 * const { sortColumn, sortDirection, handleSort, isSorted } = useSort({
 *   basePath: '/clients',
 *   defaultColumn: 'name',
 *   defaultDirection: 'asc',
 * })
 *
 * <SortableHeader
 *   column="name"
 *   label="Name"
 *   isSorted={isSorted('name')}
 *   direction={getSortDirection('name')}
 *   onClick={() => handleSort('name')}
 * />
 */
export function useSort({
  basePath,
  defaultColumn,
  defaultDirection = 'asc',
}: UseSortOptions): UseSortReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Get current sort from URL params
  const sortColumn = searchParams.get('sort') ?? defaultColumn ?? null
  const sortDirection = (searchParams.get('order') as SortDirection) ?? defaultDirection

  const handleSort = useCallback((column: string) => {
    const params = new URLSearchParams(searchParams.toString())

    // If clicking same column, toggle direction
    if (column === sortColumn) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      params.set('sort', column)
      params.set('order', newDirection)
    } else {
      // New column, start with ascending
      params.set('sort', column)
      params.set('order', 'asc')
    }

    // Reset to first page when sorting changes
    params.set('page', '1')

    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`)
    })
  }, [searchParams, router, basePath, sortColumn, sortDirection])

  const isSorted = useCallback((column: string) => {
    return sortColumn === column
  }, [sortColumn])

  const getSortDirection = useCallback((column: string): SortDirection | null => {
    return sortColumn === column ? sortDirection : null
  }, [sortColumn, sortDirection])

  return {
    sortColumn,
    sortDirection,
    handleSort,
    isPending,
    isSorted,
    getSortDirection,
  }
}
