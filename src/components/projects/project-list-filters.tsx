'use client'

import { useTransition, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounceSearch } from '@/hooks'
import { projectStatuses } from '@/lib/validations/project'
import type { useTranslations } from 'next-intl'

interface ProjectListFiltersProps {
  searchQuery: string
  statusFilter: string
  showInactive: boolean
  canEdit: boolean
  t: ReturnType<typeof useTranslations<'projects'>>
  tCommon: ReturnType<typeof useTranslations<'common'>>
  onPendingChange: (pending: boolean) => void
}

export function ProjectListFilters({
  searchQuery,
  statusFilter,
  showInactive,
  canEdit,
  t,
  tCommon,
  onPendingChange,
}: ProjectListFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isFilterPending, startTransition] = useTransition()

  const { search, setSearch } = useDebounceSearch({
    initialValue: searchQuery,
    basePath: '/projects',
  })

  const updateStatus = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('status', value)
    } else {
      params.delete('status')
    }
    params.delete('page')
    startTransition(() => {
      router.push(`/projects?${params.toString()}`)
    })
  }, [searchParams, router])

  const toggleInactive = useCallback((checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('inactive', 'true')
    } else {
      params.delete('inactive')
    }
    params.set('page', '1')
    startTransition(() => {
      router.push(`/projects?${params.toString()}`)
    })
  }, [searchParams, router])

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <SearchInput
          placeholder={t('search_placeholder')}
          value={search}
          onChange={setSearch}
          className="flex-1 sm:max-w-sm"
        />
        <Select value={statusFilter || 'all'} onValueChange={updateStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={tCommon('labels.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_statuses')}</SelectItem>
            {projectStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={toggleInactive}
          />
          <label
            htmlFor="show-inactive"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t('show_inactive')}
          </label>
        </div>
      </div>
      {canEdit && (
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('new_project')}
          </Link>
        </Button>
      )}
    </div>
  )
}
