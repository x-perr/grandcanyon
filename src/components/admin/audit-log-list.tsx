'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import type { AuditLogWithUser } from '@/app/(protected)/admin/actions'
import { AuditLogDetail } from './audit-log-detail'

interface AuditLogListProps {
  logs: AuditLogWithUser[]
  users: { id: string; first_name: string; last_name: string; email: string }[]
  totalCount: number
  currentPage: number
  pageSize: number
  searchQuery: string
  selectedAction?: string
  selectedEntity?: string
  selectedUser?: string
  dateFrom?: string
  dateTo?: string
}

const ACTION_TYPES = ['create', 'update', 'delete', 'send', 'upload']
const ENTITY_TYPES = ['user', 'settings', 'logo', 'password_reset']

export function AuditLogList({
  logs,
  users,
  totalCount,
  currentPage,
  pageSize,
  searchQuery,
  selectedAction,
  selectedEntity,
  selectedUser,
  dateFrom,
  dateTo,
}: AuditLogListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const [selectedLog, setSelectedLog] = useState<AuditLogWithUser | null>(null)

  const totalPages = Math.ceil(totalCount / pageSize)

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== searchQuery) {
        const params = new URLSearchParams(searchParams.toString())
        if (search) {
          params.set('search', search)
        } else {
          params.delete('search')
        }
        params.delete('page')
        startTransition(() => {
          router.push(`/admin/logs?${params.toString()}`)
        })
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [search, searchQuery, router, searchParams])

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    startTransition(() => {
      router.push(`/admin/logs?${params.toString()}`)
    })
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/admin/logs?${params.toString()}`)
    })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (action) {
      case 'create':
        return 'default'
      case 'update':
        return 'secondary'
      case 'delete':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getUserName = (log: AuditLogWithUser) => {
    if (!log.user) return t('logs.system_user')
    return `${log.user.first_name} ${log.user.last_name}`
  }

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('logs.search_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>

            {/* Action filter */}
            <Select
              value={selectedAction ?? 'all'}
              onValueChange={(value) => updateFilter('action', value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('logs.filter_action')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('logs.filter_action')}</SelectItem>
                {ACTION_TYPES.map((action) => (
                  <SelectItem key={action} value={action}>
                    {t(`logs.actions.${action}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity filter */}
            <Select
              value={selectedEntity ?? 'all'}
              onValueChange={(value) => updateFilter('entity', value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('logs.filter_entity')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('logs.filter_entity')}</SelectItem>
                {ENTITY_TYPES.map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {t(`logs.entities.${entity}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User filter */}
            <Select
              value={selectedUser ?? 'all'}
              onValueChange={(value) => updateFilter('user', value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('logs.filter_user')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('logs.filter_user')}</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date from */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom ?? ''}
                onChange={(e) => updateFilter('from', e.target.value)}
                className="w-36"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={dateTo ?? ''}
                onChange={(e) => updateFilter('to', e.target.value)}
                className="w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('logs.empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('logs.table.time')}</TableHead>
                  <TableHead>{t('logs.table.action')}</TableHead>
                  <TableHead>{t('logs.table.entity')}</TableHead>
                  <TableHead>{t('logs.table.user')}</TableHead>
                  <TableHead>{t('logs.table.ip')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className={isPending ? 'opacity-50' : ''}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {t(`logs.actions.${log.action}` as any) || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{t(`logs.entities.${log.entity_type}` as any) || log.entity_type}</span>
                        {log.entity_id && (
                          <span className="text-xs text-muted-foreground truncate max-w-40">
                            {log.entity_id}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getUserName(log)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.ip_address ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {logs.length} / {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
              aria-label={t('logs.pagination.previous')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || isPending}
              aria-label={t('logs.pagination.next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedLog && (
        <AuditLogDetail
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </>
  )
}
