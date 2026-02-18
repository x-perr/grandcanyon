'use client'

import { useTransition, useState } from 'react'
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

  const totalPages = Math.ceil(totalCount / pageSize)

  const updateFilters = (updates: Record<string, string | undefined>) => {
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
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    // Debounce search
    const timeoutId = setTimeout(() => {
      updateFilters({ search: value || undefined })
    }, 300)
    return () => clearTimeout(timeoutId)
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/invoices?${params.toString()}`)
    })
  }

  const handleMarkPaid = async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const result = await markInvoicePaid(invoiceId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Invoice marked as paid')
      startTransition(() => {
        router.refresh()
      })
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(summary.draft)}</div>
            <p className="text-xs text-muted-foreground">Draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.sent)}</div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.paid)}</div>
            <p className="text-xs text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            placeholder="Search invoice # or client..."
            value={search}
            onChange={handleSearch}
          />
        </div>
        <Select
          value={filters.clientId ?? 'all'}
          onValueChange={(v) => updateFilters({ clientId: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
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
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.year?.toString() ?? 'all'}
          onValueChange={(v) => updateFilters({ year: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
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
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No invoices found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {filters.search || filters.clientId || filters.status || filters.year
                ? 'Try adjusting your filters'
                : 'Create your first invoice to get started'}
            </p>
            {!filters.search && !filters.clientId && !filters.status && (
              <Button asChild className="mt-4">
                <Link href="/invoices/new">Create Invoice</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead className="hidden lg:table-cell">Project</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
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
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/invoices/${invoice.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/api/invoices/${invoice.id}/pdf`} target="_blank">
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                          </Link>
                        </DropdownMenuItem>
                        {invoice.status === 'sent' && (
                          <DropdownMenuItem onClick={(e) => handleMarkPaid(invoice.id, e as unknown as React.MouseEvent)}>
                            <Check className="mr-2 h-4 w-4" />
                            Mark as Paid
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
            Showing {(currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
