'use client'

import { useState, useTransition, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  HardHat,
  MoreHorizontal,
  Pencil,
  MapPin,
  MapPinOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import type { UserWithRole } from '@/app/(protected)/admin/actions'

interface EmployeeListProps {
  employees: UserWithRole[]
  totalCount: number
  currentPage: number
  pageSize: number
  searchQuery: string
  showInactive: boolean
}

export function EmployeeList({
  employees,
  totalCount,
  currentPage,
  pageSize,
  searchQuery,
  showInactive,
}: EmployeeListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const updateSearch = useCallback((value: string) => {
    setSearch(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value)
      } else {
        params.delete('search')
      }
      params.delete('page')
      startTransition(() => {
        router.push(`/admin/employees?${params.toString()}`)
      })
    }, 300)
  }, [searchParams, router])

  const toggleInactive = useCallback((checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('inactive', 'true')
    } else {
      params.delete('inactive')
    }
    params.delete('page')
    startTransition(() => {
      router.push(`/admin/employees?${params.toString()}`)
    })
  }, [searchParams, router])

  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/admin/employees?${params.toString()}`)
    })
  }, [searchParams, router])

  const hasAddress = useCallback((employee: UserWithRole) => {
    return !!(employee.person?.address || employee.person?.city)
  }, [])

  const hasCoordinates = useCallback((employee: UserWithRole) => {
    return employee.person?.lat != null && employee.person?.lng != null
  }, [])

  const formatAddress = useCallback((employee: UserWithRole) => {
    if (!employee.person) return '-'
    const parts = [employee.person.address, employee.person.city].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : '-'
  }, [])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <SearchInput
            placeholder={t('employees.search_placeholder')}
            value={search}
            onChange={updateSearch}
            className="w-full sm:w-64"
          />
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
              {t('employees.show_inactive')}
            </label>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('employees.field_workers_only')}
        </p>
      </div>

      {/* Table */}
      {employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HardHat className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('employees.no_employees')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery ? t('employees.search_empty') : t('employees.no_employees_message')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon('labels.name')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('users.role')}</TableHead>
                <TableHead>{tCommon('labels.address')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('employees.map_ready')}</TableHead>
                <TableHead>{tCommon('labels.status')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/users/${employee.id}/edit`)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground sm:hidden">
                        {employee.role?.name ?? '-'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {employee.role?.name ?? '-'}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={formatAddress(employee)}>
                      {formatAddress(employee)}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {hasCoordinates(employee) ? (
                      <Badge variant="default" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        {t('employees.has_coords')}
                      </Badge>
                    ) : hasAddress(employee) ? (
                      <Badge variant="secondary" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        {t('employees.needs_geocode')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <MapPinOff className="h-3 w-3" />
                        {t('employees.no_address')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                      {employee.is_active ? tCommon('status.active') : tCommon('status.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{tCommon('labels.actions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/users/${employee.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('employees.edit_address')}
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {tCommon('pagination.showing', {
              start: (currentPage - 1) * pageSize + 1,
              end: Math.min(currentPage * pageSize, totalCount),
              total: totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              {tCommon('actions.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              {tCommon('actions.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
