'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { approveTimesheet, rejectTimesheet, bulkApproveTimesheets } from '@/app/(protected)/timesheets/actions'
import type { TeamTimesheetRow } from '@/app/(protected)/timesheets/actions'
import { Eye, Check, X, Search, Loader2 } from 'lucide-react'

interface TeamTimesheetListProps {
  rows: TeamTimesheetRow[]
  weekStart: string
}

type StatusFilter = 'all' | 'not_started' | 'draft' | 'submitted' | 'approved'

export function TeamTimesheetList({ rows, weekStart }: TeamTimesheetListProps) {
  const t = useTranslations('timesheets.team')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Filter rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Search filter
      const searchLower = search.toLowerCase()
      const matchesSearch =
        !search ||
        row.firstName.toLowerCase().includes(searchLower) ||
        row.lastName.toLowerCase().includes(searchLower) ||
        row.email.toLowerCase().includes(searchLower)

      // Status filter
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [rows, search, statusFilter])

  // Submitted timesheets for bulk selection
  const submittedRows = useMemo(() => filteredRows.filter((r) => r.status === 'submitted'), [filteredRows])

  // Handle individual approve
  const handleApprove = useCallback(async (timesheetId: string) => {
    setLoadingId(timesheetId)
    const result = await approveTimesheet(timesheetId)
    setLoadingId(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('approved_success'))
      router.refresh()
    }
  }, [t, router])

  // Handle individual reject
  const handleReject = useCallback(async (timesheetId: string) => {
    setLoadingId(timesheetId)
    const result = await rejectTimesheet(timesheetId)
    setLoadingId(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('rejected_success'))
      router.refresh()
    }
  }, [t, router])

  // Handle bulk approve
  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return

    setBulkLoading(true)
    const result = await bulkApproveTimesheets(Array.from(selectedIds))
    setBulkLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('bulk_approved_success', { count: result.approvedCount ?? 0 }))
      setSelectedIds(new Set())
      router.refresh()
    }
  }, [selectedIds, t, router])

  // Toggle selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Select all submitted
  const selectAllSubmitted = useCallback(() => {
    const submittedIds = submittedRows.map((r) => r.timesheetId).filter(Boolean) as string[]
    if (selectedIds.size === submittedIds.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(submittedIds))
    }
  }, [submittedRows, selectedIds])

  // Status badge
  const getStatusBadge = (status: TeamTimesheetRow['status']) => {
    switch (status) {
      case 'not_started':
        return <Badge variant="outline">{t('status.not_started')}</Badge>
      case 'draft':
        return <Badge variant="secondary">{t('status.draft')}</Badge>
      case 'submitted':
        return <Badge variant="default" className="bg-amber-500">{t('status.submitted')}</Badge>
      case 'approved':
        return <Badge variant="default" className="bg-green-500">{t('status.approved')}</Badge>
      case 'rejected':
        return <Badge variant="destructive">{t('status.rejected')}</Badge>
      case 'locked':
        return <Badge variant="default" className="bg-blue-500">{t('status.locked')}</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="not_started">{t('status.not_started')}</SelectItem>
              <SelectItem value="draft">{t('status.draft')}</SelectItem>
              <SelectItem value="submitted">{t('status.submitted')}</SelectItem>
              <SelectItem value="approved">{t('status.approved')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk actions */}
        {submittedRows.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllSubmitted}
            >
              {selectedIds.size === submittedRows.length ? t('deselect_all') : t('select_all_submitted')}
            </Button>
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={selectedIds.size === 0 || bulkLoading}
            >
              {bulkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('approve_selected', { count: selectedIds.size })}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {submittedRows.length > 0 && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedIds.size > 0 && selectedIds.size === submittedRows.length}
                    onCheckedChange={() => selectAllSubmitted()}
                  />
                </TableHead>
              )}
              <TableHead>{t('columns.employee')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead className="text-right">{t('columns.hours')}</TableHead>
              <TableHead>{t('columns.submitted')}</TableHead>
              <TableHead className="text-right">{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={submittedRows.length > 0 ? 6 : 5} className="text-center text-muted-foreground">
                  {t('no_results')}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.userId}>
                  {submittedRows.length > 0 && (
                    <TableCell>
                      {row.status === 'submitted' && row.timesheetId && (
                        <Checkbox
                          checked={selectedIds.has(row.timesheetId)}
                          onCheckedChange={() => toggleSelection(row.timesheetId!)}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.firstName} {row.lastName}</p>
                      <p className="text-sm text-muted-foreground">{row.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(row.status)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {row.totalHours > 0 ? row.totalHours.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell>
                    {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {row.timesheetId && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/timesheets/${weekStart}/review?id=${row.timesheetId}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {row.status === 'submitted' && row.timesheetId && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(row.timesheetId!)}
                            disabled={loadingId === row.timesheetId}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            {loadingId === row.timesheetId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(row.timesheetId!)}
                            disabled={loadingId === row.timesheetId}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer stats */}
      <div className="text-sm text-muted-foreground">
        {t('footer_stats', {
          showing: filteredRows.length,
          total: rows.length,
          pendingCount: submittedRows.length,
        })}
      </div>
    </div>
  )
}
