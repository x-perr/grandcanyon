'use client'

import { Check, X, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/ui/status-badge'
import { TableCell, TableRow } from '@/components/ui/table'
import type { useTranslations } from 'next-intl'
import type { TeamTimesheetRow } from '@/app/(protected)/timesheets/actions'

interface TeamTimesheetRowProps {
  row: TeamTimesheetRow
  canApprove: boolean
  showCheckbox: boolean
  isSelected: boolean
  onToggleSelect: (timesheetId: string) => void
  onViewDetail: (row: TeamTimesheetRow) => void
  onApprove: (timesheetId: string) => void
  onReject: (timesheetId: string) => void
  locale: 'en' | 'fr'
  t: ReturnType<typeof useTranslations<'timesheets'>>
  tCommon: ReturnType<typeof useTranslations<'common'>>
}

export function TeamTimesheetRowItem({
  row,
  canApprove,
  showCheckbox,
  isSelected,
  onToggleSelect,
  onViewDetail,
  onApprove,
  onReject,
  locale,
  t,
  tCommon,
}: TeamTimesheetRowProps) {
  const formatHours = (hours: number) => hours.toFixed(1)

  return (
    <TableRow>
      {showCheckbox && (
        <TableCell>
          {row.status === 'submitted' && row.timesheetId && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(row.timesheetId!)}
              aria-label={t('team.select_employee', {
                name: `${row.firstName} ${row.lastName}`,
              })}
            />
          )}
        </TableCell>
      )}
      <TableCell>
        <div>
          <div className="font-medium">
            {row.firstName} {row.lastName}
          </div>
          <div className="text-sm text-muted-foreground">{row.email}</div>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={row.status} />
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatHours(row.totalHours)}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {row.submittedAt
          ? new Date(row.submittedAt).toLocaleDateString(locale, {
              month: 'short',
              day: 'numeric',
            })
          : '-'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {row.timesheetId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewDetail(row)}
              title={tCommon('actions.view')}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {canApprove && row.status === 'submitted' && row.timesheetId && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onApprove(row.timesheetId!)}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                title={t('actions.approve')}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onReject(row.timesheetId!)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                title={t('actions.reject')}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
