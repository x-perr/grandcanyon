'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface UseDebounceSearchOptions {
  /** Initial search value */
  initialValue?: string
  /** Debounce delay in milliseconds */
  delay?: number
  /** Base path for URL updates (e.g., '/clients') */
  basePath: string
  /** Search param key (defaults to 'search') */
  paramKey?: string
}

interface UseDebounceSearchReturn {
  /** Current search value (controlled) */
  search: string
  /** Update search value (debounced URL update) */
  setSearch: (value: string) => void
  /** Whether a search transition is pending */
  isPending: boolean
}

/**
 * Hook for debounced search with URL state management
 *
 * @example
 * const { search, setSearch, isPending } = useDebounceSearch({
 *   initialValue: searchQuery,
 *   basePath: '/clients',
 * })
 */
export function useDebounceSearch({
  initialValue = '',
  delay = 300,
  basePath,
  paramKey = 'search',
}: UseDebounceSearchOptions): UseDebounceSearchReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearchState] = useState(initialValue)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const setSearch = useCallback((value: string) => {
    setSearchState(value)

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce URL update
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())

      if (value) {
        params.set(paramKey, value)
      } else {
        params.delete(paramKey)
      }

      // Reset to first page on search
      params.delete('page')

      startTransition(() => {
        router.push(`${basePath}?${params.toString()}`)
      })
    }, delay)
  }, [searchParams, router, basePath, paramKey, delay])

  return {
    search,
    setSearch,
    isPending,
  }
}
