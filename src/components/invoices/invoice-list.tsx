'use client'

import { useTransition, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FileText, ExternalLink, Download, MoreHorizontal, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { SearchInput } from '@/components/ui/search-input'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/tax'
import { markInvoicePaid } from '@/app/(protected)/invoices/actions'
import type { InvoiceWithRelations, ClientForSelect } from '@/app/(protected)/invoices/actions'
import type { InvoiceStatus } from '@/lib/validations/invoice'
import { toast } from 'sonner'
import { useTranslations, useLocale } from 'next-intl'

interface InvoiceListProps {
  invoices: InvoiceWithRelations[]
  totalCount: number
  currentPage: number
  pageSize: number
  clients: ClientForSelect[]
  years: number[]
  summary: { draft: number; sent: number; paid: number }
  filters: {
    search?: string
    clientId?: string
    status?: string
    year?: number
  }
}

export function InvoiceList({
  invoices,
  totalCount,
  currentPage,
  pageSize,
  clients,
  years,
  summary,
  filters,
}: InvoiceListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(filters.search ?? '')
  const t = useTranslations('invoices')
  const tc = useTranslations('common')
  const locale = useLocale()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize derived calculations
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const updateFilters = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())

    // Reset to page 1 when filters change
    params.delete('page')

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    startTransition(() => {
      router.push(`/invoices?${params.toString()}`)
    })
  }, [searchParams, router])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('page')
      if (value) {
        params.set('search', value)
      } else {
        params.delete('search')
      }
      startTransition(() => {
        router.push(`/invoices?${params.toString()}`)
      })
    }, 300)
  }, [searchParams, router])

  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/invoices?${params.toString()}`)
    })
  }, [searchParams, router])

  const handleMarkPaid = useCallback(async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const result = await markInvoicePaid(invoiceId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('toast.marked_paid'))
      startTransition(() => {
        router.refresh()
      })
    }
  }, [t, router])

  const formatDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [locale])

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(summary.draft)}</div>
            <p className="text-xs text-muted-foreground">{t('summary.draft')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.sent)}</div>
            <p className="text-xs text-muted-foreground">{t('summary.outstanding')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.paid)}</div>
            <p className="text-xs text-muted-foreground">{t('summary.paid_ytd')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            placeholder={t('search_placeholder')}
            value={search}
            onChange={handleSearch}
          />
        </div>
        <Select
          value={filters.clientId ?? 'all'}
          onValueChange={(v) => updateFilters({ clientId: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('all_clients')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_clients')}</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(v) => updateFilters({ status: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('all_statuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_statuses')}</SelectItem>
            <SelectItem value="draft">{tc('status.draft')}</SelectItem>
            <SelectItem value="sent">{tc('status.sent')}</SelectItem>
            <SelectItem value="paid">{tc('status.paid')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.year?.toString() ?? 'all'}
          onValueChange={(v) => updateFilters({ year: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('all_years')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_years')}</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-300">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('no_invoices')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {filters.search || filters.clientId || filters.status || filters.year
                ? tc('pagination.try_adjusting_filters')
                : t('no_invoices_message')}
            </p>
            {!filters.search && !filters.clientId && !filters.status && (
              <Button asChild className="mt-4">
                <Link href="/invoices/new">{t('new_invoice')}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('list.invoice_number')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('list.client')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('list.project')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('list.date')}</TableHead>
                <TableHead className="text-right">{t('list.total')}</TableHead>
                <TableHead>{t('list.status')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <TableCell>
                    <div className="font-medium">{invoice.invoice_number}</div>
                    <div className="text-sm text-muted-foreground md:hidden">
                      {invoice.client?.name}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {invoice.client?.name ?? '-'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {invoice.project?.code ?? '-'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {formatDate(invoice.invoice_date)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(invoice.total)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status as InvoiceStatus} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{t('list.actions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/invoices/${invoice.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {t('actions.view')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/api/invoices/${invoice.id}/pdf`} target="_blank">
                            <Download className="mr-2 h-4 w-4" />
                            {t('actions.download_pdf')}
                          </Link>
                        </DropdownMenuItem>
                        {invoice.status === 'sent' && (
                          <DropdownMenuItem onClick={(e) => handleMarkPaid(invoice.id, e as unknown as React.MouseEvent)}>
                            <Check className="mr-2 h-4 w-4" />
                            {t('actions.mark_paid')}
                          </DropdownMenuItem>
                        )}
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
            {tc('pagination.showing', {
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
              {tc('actions.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              {tc('actions.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
