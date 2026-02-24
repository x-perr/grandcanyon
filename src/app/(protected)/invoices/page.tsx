import { getUserPermissions, hasPermission } from '@/lib/auth'
import {
  getInvoices,
  getInvoiceSummary,
  getClientsForInvoice,
  getInvoiceYears,
} from './actions'
import { InvoiceList } from '@/components/invoices/invoice-list'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Enums } from '@/types/database'
import { getTranslations } from 'next-intl/server'

interface InvoicesPageProps {
  searchParams: Promise<{
    search?: string
    clientId?: string
    status?: string
    year?: string
    page?: string
  }>
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const pageSize = 25
  const year = params.year ? Number(params.year) : undefined

  const [{ invoices, count }, summary, clients, years, permissions, t] = await Promise.all([
    getInvoices({
      search: params.search,
      clientId: params.clientId,
      status: params.status as Enums<'invoice_status'> | undefined,
      year,
      limit: pageSize,
      offset: (page - 1) * pageSize,
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
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('new_invoice')}
            </Link>
          </Button>
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
