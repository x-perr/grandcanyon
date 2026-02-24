import { Suspense } from 'react'
import { FileText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportFilters } from '@/components/reports/report-filters'
import { InvoiceReport } from '@/components/reports/invoice-report'
import {
  getInvoiceReportData,
  getInvoiceAgingSummary,
  getInvoiceTotalsByStatus,
  getProjectsForFilter,
  getClientsForFilter,
} from '../actions'
import { parseReportFilters } from '@/lib/validations/report'
import { getTranslations } from 'next-intl/server'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvoiceReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters = parseReportFilters(params)
  const t = await getTranslations('reports.invoices')
  const tc = await getTranslations('common.status')

  const statusOptions = [
    { value: 'draft', label: tc('draft') },
    { value: 'sent', label: tc('sent') },
    { value: 'paid', label: tc('paid') },
  ]

  const [data, aging, totals, projects, clients] = await Promise.all([
    getInvoiceReportData(filters),
    getInvoiceAgingSummary(filters),
    getInvoiceTotalsByStatus(filters),
    getProjectsForFilter(),
    getClientsForFilter(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={<FilterSkeleton />}>
        <ReportFilters
          basePath="/reports/invoices"
          projects={projects}
          clients={clients}
          showProjectFilter={true}
          showClientFilter={true}
          showStatusFilter={true}
          statusOptions={statusOptions}
          currentFilters={{
            startDate: filters.startDate,
            endDate: filters.endDate,
            projectId: filters.projectId,
            clientId: filters.clientId,
            status: filters.status,
            preset: filters.preset,
          }}
        />
      </Suspense>

      {/* Report */}
      <Suspense fallback={<ReportSkeleton />}>
        <InvoiceReport data={data} aging={aging} totals={totals} />
      </Suspense>
    </div>
  )
}

function FilterSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-20" />
      <Skeleton className="h-[400px]" />
    </div>
  )
}
