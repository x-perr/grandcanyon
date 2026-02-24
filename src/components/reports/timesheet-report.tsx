'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/tax'
import type { TimesheetReportRow } from '@/app/(protected)/reports/actions'
import { ReportExportButton } from './report-export-button'
import type { ColumnDefinition } from '@/lib/csv'
import { formatCurrencyForCSV, formatHoursForCSV } from '@/lib/csv'
import { useTranslations, useLocale } from 'next-intl'

interface TimesheetReportProps {
  data: TimesheetReportRow[]
  summary: {
    totalHours: number
    billableHours: number
    totalValue: number
  }
}

export function TimesheetReport({ data, summary }: TimesheetReportProps) {
  const t = useTranslations('reports.timesheets')
  const tc = useTranslations('common.labels')
  const locale = useLocale()

  const csvColumns: ColumnDefinition<TimesheetReportRow>[] = [
    { key: 'userName', header: t('columns.user') },
    { key: 'projectCode', header: 'Project Code' },
    { key: 'projectName', header: 'Project Name' },
    { key: 'taskCode', header: 'Task Code' },
    { key: 'taskName', header: 'Task Name' },
    { key: 'weekStart', header: 'Week Start' },
    { key: 'hours', header: t('columns.hours'), format: (v) => formatHoursForCSV(v as number) },
    { key: 'rate', header: tc('rate'), format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'value', header: 'Value', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'isBillable', header: 'Billable', format: (v) => (v ? 'Yes' : 'No') },
  ]

  const nonBillableHours = summary.totalHours - summary.billableHours
  const utilizationRate = summary.totalHours > 0
    ? ((summary.billableHours / summary.totalHours) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('summary.total_hours')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalHours.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('columns.billable_hours')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary.billableHours.toFixed(1)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('columns.non_billable_hours')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {nonBillableHours.toFixed(1)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('summary.total_value')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {utilizationRate}% {t('summary.utilization')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <ReportExportButton
          data={data}
          columns={csvColumns}
          filename="timesheet-report"
        />
      </div>

      {/* Data Table */}
      {data.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
              {t('no_data')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.user')}</TableHead>
                <TableHead>{t('columns.project')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('columns.task')}</TableHead>
                <TableHead>{t('columns.week')}</TableHead>
                <TableHead className="text-right">{t('columns.hours')}</TableHead>
                <TableHead className="text-right hidden sm:table-cell">{tc('rate')}</TableHead>
                <TableHead className="text-right">{t('columns.value')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow key={`${row.userId}-${row.projectId}-${row.weekStart}-${index}`}>
                  <TableCell className="font-medium">{row.userName}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.projectCode}
                      </span>
                      <span className="ml-2">{row.projectName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.taskCode ? (
                      <span className="text-sm text-muted-foreground">
                        {row.taskCode} - {row.taskName}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatWeekDate(row.weekStart, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={row.isBillable ? '' : 'text-muted-foreground'}>
                      {row.hours.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {row.rate > 0 ? formatCurrency(row.rate) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.value > 0 ? formatCurrency(row.value) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  {tc('total')}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {summary.totalHours.toFixed(1)}
                </TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-semibold">
                  {formatCurrency(summary.totalValue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  )
}

function formatWeekDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    month: 'short',
    day: 'numeric',
  })
}
