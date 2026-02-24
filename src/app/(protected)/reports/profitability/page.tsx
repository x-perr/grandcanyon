import { Suspense } from 'react'
import { TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportFilters } from '@/components/reports/report-filters'
import { ProfitabilityReport } from '@/components/reports/profitability-report'
import {
  getProfitabilityReportData,
  getProfitabilitySummary,
  getProjectsForFilter,
  getClientsForFilter,
} from '../actions'
import { parseReportFilters } from '@/lib/validations/report'
import { getTranslations } from 'next-intl/server'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ProfitabilityReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters = parseReportFilters(params)
  const t = await getTranslations('reports.profitability')

  const [data, summary, projects, clients] = await Promise.all([
    getProfitabilityReportData(filters),
    getProfitabilitySummary(filters),
    getProjectsForFilter(),
    getClientsForFilter(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
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
          basePath="/reports/profitability"
          projects={projects}
          clients={clients}
          showProjectFilter={true}
          showClientFilter={true}
          currentFilters={{
            startDate: filters.startDate,
            endDate: filters.endDate,
            projectId: filters.projectId,
            clientId: filters.clientId,
            preset: filters.preset,
          }}
        />
      </Suspense>

      {/* Report */}
      <Suspense fallback={<ReportSkeleton />}>
        <ProfitabilityReport data={data} summary={summary} />
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
      <div className="grid gap-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-[400px]" />
    </div>
  )
}
