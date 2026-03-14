'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCurrency, calculateLineAmount } from '@/lib/tax'
import { Clock, Calendar } from 'lucide-react'
import type { UninvoicedEntry } from '@/app/(protected)/invoices/actions'
import type { RateSource } from '@/types/billing'
import { useTranslations, useLocale } from 'next-intl'

interface StepSelectEntriesProps {
  entries: UninvoicedEntry[]
  selectedEntryIds: string[]
  onSelectionChange: (ids: string[]) => void
  periodStart: string
  periodEnd: string
  onPeriodStartChange: (date: string) => void
  onPeriodEndChange: (date: string) => void
}

/** Map rate source to badge styling */
function getRateSourceBadgeProps(source: RateSource, tierCode?: string | null): {
  className: string
  labelKey: string
  labelParams: Record<string, string> | undefined
} {
  switch (source) {
    case 'client_tier':
      return {
        className: 'bg-blue-100 text-blue-700 border-blue-200',
        labelKey: 'client_tier',
        labelParams: { code: tierCode ?? '?' },
      }
    case 'default_tier':
      return {
        className: 'bg-gray-100 text-gray-600 border-gray-200',
        labelKey: 'default_tier',
        labelParams: undefined,
      }
    case 'project_override':
      return {
        className: 'bg-purple-100 text-purple-700 border-purple-200',
        labelKey: 'project_override',
        labelParams: undefined,
      }
    case 'employee_override':
      return {
        className: 'bg-orange-100 text-orange-700 border-orange-200',
        labelKey: 'employee_override',
        labelParams: undefined,
      }
    case 'legacy_role':
    default:
      return {
        className: 'bg-gray-50 text-gray-400 border-gray-200',
        labelKey: 'legacy_role',
        labelParams: undefined,
      }
  }
}

export function StepSelectEntries({
  entries,
  selectedEntryIds,
  onSelectionChange,
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
}: StepSelectEntriesProps) {
  const t = useTranslations('invoices')
  const tc = useTranslations('common')
  const locale = useLocale()

  // Filter entries by period
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const weekStart = entry.timesheet?.week_start
      if (!weekStart) return false
      if (periodStart && weekStart < periodStart) return false
      if (periodEnd && weekStart > periodEnd) return false
      return true
    })
  }, [entries, periodStart, periodEnd])

  // Convert selectedEntryIds to Set for O(1) lookups
  const selectedIdSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds])

  // Calculate totals using resolved rate
  const selectedEntries = filteredEntries.filter((e) => selectedIdSet.has(e.id))
  const totalHours = selectedEntries.reduce(
    (sum, e) => sum + (e.hours?.reduce((s, h) => s + (h ?? 0), 0) ?? 0),
    0
  )
  const totalAmount = selectedEntries.reduce((sum, e) => {
    const hours = e.hours?.reduce((s, h) => s + (h ?? 0), 0) ?? 0
    const rate = e.resolved_rate ?? e.billing_role?.rate ?? 0
    return sum + calculateLineAmount(hours, rate)
  }, 0)

  // Handlers
  const handleSelectAll = () => {
    if (selectedEntryIds.length === filteredEntries.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(filteredEntries.map((e) => e.id))
    }
  }

  const handleToggleEntry = (entryId: string) => {
    if (selectedIdSet.has(entryId)) {
      onSelectionChange(selectedEntryIds.filter((id) => id !== entryId))
    } else {
      onSelectionChange([...selectedEntryIds, entryId])
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      month: 'short',
      day: 'numeric',
    })
  }

  const formatHours = (hours: number[] | null) => {
    if (!hours) return '0.0'
    const total = hours.reduce((sum, h) => sum + (h ?? 0), 0)
    return total.toFixed(1)
  }

  /** Check if entry has any approved OT days */
  const hasApprovedOt = (entry: UninvoicedEntry): boolean => {
    if (!entry.ot_flags?.days) return false
    return Object.values(entry.ot_flags.days).some((d) => d.status === 'approved')
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t('wizard.step2_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('wizard.step2_desc')}
        </p>
      </div>

      {/* Period Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            {t('wizard.billing_period')}
          </CardTitle>
          <CardDescription>{t('wizard.filter_by_date')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="period_start">{tc('labels.from')}</Label>
              <Input
                id="period_start"
                type="date"
                value={periodStart}
                onChange={(e) => onPeriodStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">{tc('labels.to')}</Label>
              <Input
                id="period_end"
                type="date"
                value={periodEnd}
                onChange={(e) => onPeriodEndChange(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('wizard.no_uninvoiced_entries')}</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              {(periodStart || periodEnd) ? t('wizard.no_entries_in_period') : t('wizard.no_entries_message')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Select All */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedEntryIds.length === filteredEntries.length ? t('wizard.deselect_all') : t('wizard.select_all')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('wizard.x_of_y_selected', { selected: selectedEntryIds.length, total: filteredEntries.length })}
            </span>
          </div>

          {/* Table */}
          <TooltipProvider>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>{t('wizard.week')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('wizard.employee')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('wizard.task')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('wizard.role')}</TableHead>
                    <TableHead className="text-right">{tc('labels.hours')}</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">{t('wizard.resolved_rate')}</TableHead>
                    <TableHead className="text-right">{tc('labels.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const hours = entry.hours?.reduce((s, h) => s + (h ?? 0), 0) ?? 0
                    const resolvedRate = entry.resolved_rate ?? entry.billing_role?.rate ?? 0
                    const legacyRate = entry.billing_role?.rate ?? 0
                    const ratesDiffer = entry.resolved_rate != null && entry.resolved_rate !== legacyRate && legacyRate > 0
                    const amount = calculateLineAmount(hours, resolvedRate)
                    const isSelected = selectedIdSet.has(entry.id)
                    const rateSource = entry.rate_source ?? 'legacy_role'
                    const badgeProps = getRateSourceBadgeProps(rateSource, entry.rate_tier_code)
                    const entryHasOt = hasApprovedOt(entry)

                    return (
                      <TableRow
                        key={entry.id}
                        className={`cursor-pointer ${isSelected ? 'bg-muted/50' : ''} ${entryHasOt ? 'border-l-2 border-l-amber-400' : ''}`}
                        onClick={() => handleToggleEntry(entry.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleEntry(entry.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-1.5">
                              {formatDate(entry.timesheet?.week_start)}
                              {entryHasOt && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1 py-0">
                                  {t('ot.badge')}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground sm:hidden">
                              {entry.timesheet?.user?.first_name} {entry.timesheet?.user?.last_name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {entry.timesheet?.user?.first_name} {entry.timesheet?.user?.last_name}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {entry.task?.name ?? '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {entry.billing_role?.name ?? '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatHours(entry.hours)}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="font-mono">
                              {formatCurrency(resolvedRate)}
                              {ratesDiffer && (
                                <span className="text-xs text-muted-foreground line-through ml-1">
                                  {formatCurrency(legacyRate)}
                                </span>
                              )}
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1 py-0 cursor-default ${badgeProps.className}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {t(`rate_source.${badgeProps.labelKey}`, badgeProps.labelParams)}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <div>{t(`rate_source.${badgeProps.labelKey}`, badgeProps.labelParams)}</div>
                                  {entry.rate_classification_level && (
                                    <div className="text-muted-foreground">{entry.rate_classification_level}</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(amount)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>

          {/* Summary */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>{t('wizard.selected_total')}</span>
                <div className="text-right">
                  <div>{formatCurrency(totalAmount)}</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {t('wizard.hours', { hours: totalHours.toFixed(1) })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
