'use client'

import { useMemo, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface UsePaginationOptions {
  /** Total number of items */
  totalCount: number
  /** Items per page */
  pageSize: number
  /** Current page number */
  currentPage: number
  /** Base path for URL updates (e.g., '/clients') */
  basePath: string
  /** Enable keyboard navigation (arrow keys) */
  enableKeyboardNav?: boolean
}

interface UsePaginationReturn {
  /** Total number of pages */
  totalPages: number
  /** Navigate to a specific page */
  goToPage: (page: number) => void
  /** Navigate to previous page */
  goToPrevious: () => void
  /** Navigate to next page */
  goToNext: () => void
  /** Whether a page transition is pending */
  isPending: boolean
  /** Whether there's a previous page */
  hasPrevious: boolean
  /** Whether there's a next page */
  hasNext: boolean
  /** Start index for "Showing X-Y of Z" display */
  startIndex: number
  /** End index for "Showing X-Y of Z" display */
  endIndex: number
}

/**
 * Hook for URL-based pagination with optional keyboard navigation
 *
 * @example
 * const {
 *   totalPages,
 *   goToPage,
 *   goToPrevious,
 *   goToNext,
 *   isPending,
 *   hasPrevious,
 *   hasNext,
 *   startIndex,
 *   endIndex,
 * } = usePagination({
 *   totalCount,
 *   pageSize,
 *   currentPage,
 *   basePath: '/clients',
 *   enableKeyboardNav: true,
 * })
 */
export function usePagination({
  totalCount,
  pageSize,
  currentPage,
  basePath,
  enableKeyboardNav = false,
}: UsePaginationOptions): UsePaginationReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Memoize derived calculations
  const totalPages = useMemo(
    () => Math.ceil(totalCount / pageSize),
    [totalCount, pageSize]
  )

  const hasPrevious = currentPage > 1
  const hasNext = currentPage < totalPages

  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalCount)

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return

    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))

    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`)
    })
  }, [searchParams, router, basePath, totalPages])

  const goToPrevious = useCallback(() => {
    if (hasPrevious) goToPage(currentPage - 1)
  }, [hasPrevious, currentPage, goToPage])

  const goToNext = useCallback(() => {
    if (hasNext) goToPage(currentPage + 1)
  }, [hasNext, currentPage, goToPage])

  // Keyboard navigation
  useEffect(() => {
    if (!enableKeyboardNav) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (e.key === 'ArrowLeft' && hasPrevious) {
        e.preventDefault()
        goToPrevious()
      }
      if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableKeyboardNav, hasPrevious, hasNext, goToPrevious, goToNext])

  return {
    totalPages,
    goToPage,
    goToPrevious,
    goToNext,
    isPending,
    hasPrevious,
    hasNext,
    startIndex,
    endIndex,
  }
}
