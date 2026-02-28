import { getUserPermissions, hasPermission } from '@/lib/auth'
import {
  getInvoices,
  getInvoiceSummary,
  getClientsForInvoice,
  getInvoiceYears,
} from './actions'
import type { SortColumn, SortDirection } from './actions'
import { InvoiceList } from '@/components/invoices/invoice-list'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Layers } from 'lucide-react'
import type { Enums } from '@/types/database'
import { getTranslations } from 'next-intl/server'

const VALID_SORT_COLUMNS: SortColumn[] = ['invoice_number', 'invoice_date', 'due_date', 'total', 'status', 'created_at']

interface InvoicesPageProps {
  searchParams: Promise<{
    search?: string
    clientId?: string
    status?: string
    year?: string
    page?: string
    sort?: string
    order?: string
  }>
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const pageSize = 25
  const year = params.year ? Number(params.year) : undefined
  const sortColumn = VALID_SORT_COLUMNS.includes(params.sort as SortColumn)
    ? (params.sort as SortColumn)
    : 'invoice_date'
  const sortDirection: SortDirection = params.order === 'asc' ? 'asc' : 'desc'

  const [{ invoices, count }, summary, clients, years, permissions, t] = await Promise.all([
    getInvoices({
      search: params.search,
      clientId: params.clientId,
      status: params.status as Enums<'invoice_status'> | undefined,
      year,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortColumn,
      sortDirection,
    }),
    getInvoiceSummary(year),
    getClientsForInvoice(),
    getInvoiceYears(),
    getUserPermissions(),
    getTranslations('invoices'),
  ])

  const canCreate = hasPermission(permissions, 'invoices.create')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/invoices/batch">
                <Layers className="mr-2 h-4 w-4" />
                {t('batch.title')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/invoices/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('new_invoice')}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <InvoiceList
        invoices={invoices}
        totalCount={count}
        currentPage={page}
        pageSize={pageSize}
        clients={clients}
        years={years}
        summary={summary}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        filters={{
          search: params.search,
          clientId: params.clientId,
          status: params.status,
          year,
        }}
      />
    </div>
  )
}
