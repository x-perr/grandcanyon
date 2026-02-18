import { Suspense } from 'react'
import { Clock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportFilters } from '@/components/reports/report-filters'
import { TimesheetReport } from '@/components/reports/timesheet-report'
import {
  getTimesheetReportData,
  getTimesheetSummary,
  getProjectsForFilter,
  getUsersForFilter,
} from '../actions'
import { parseReportFilters } from '@/lib/validations/report'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TimesheetReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters = parseReportFilters(params)

  const [data, summary, projects, users] = await Promise.all([
    getTimesheetReportData(filters),
    getTimesheetSummary(filters),
    getProjectsForFilter(),
    getUsersForFilter(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timesheet Report</h1>
          <p className="text-muted-foreground">
            View timesheet hours by user, project, and date range
          </p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={<FilterSkeleton />}>
        <ReportFilters
          basePath="/reports/timesheets"
          projects={projects}
          users={users}
          showProjectFilter={true}
          showUserFilter={true}
          currentFilters={{
            startDate: filters.startDate,
            endDate: filters.endDate,
            projectId: filters.projectId,
            userId: filters.userId,
            preset: filters.preset,
          }}
        />
      </Suspense>

      {/* Report */}
      <Suspense fallback={<ReportSkeleton />}>
        <TimesheetReport data={data} summary={summary} />
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
      <Skeleton className="h-[400px]" />
    </div>
  )
}
