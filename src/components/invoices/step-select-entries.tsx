'use client'

import { useState, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, calculateLineAmount } from '@/lib/tax'
import { Clock, Calendar } from 'lucide-react'
import type { UninvoicedEntry } from '@/app/(protected)/invoices/actions'
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

  // Calculate totals
  const selectedEntries = filteredEntries.filter((e) => selectedEntryIds.includes(e.id))
  const totalHours = selectedEntries.reduce(
    (sum, e) => sum + (e.hours?.reduce((s, h) => s + (h ?? 0), 0) ?? 0),
    0
  )
  const totalAmount = selectedEntries.reduce((sum, e) => {
    const hours = e.hours?.reduce((s, h) => s + (h ?? 0), 0) ?? 0
    const rate = e.billing_role?.rate ?? 0
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
    if (selectedEntryIds.includes(entryId)) {
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
                  <TableHead className="text-right hidden sm:table-cell">{tc('labels.rate')}</TableHead>
                  <TableHead className="text-right">{tc('labels.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const hours = entry.hours?.reduce((s, h) => s + (h ?? 0), 0) ?? 0
                  const rate = entry.billing_role?.rate ?? 0
                  const amount = calculateLineAmount(hours, rate)
                  const isSelected = selectedEntryIds.includes(entry.id)

                  return (
                    <TableRow
                      key={entry.id}
                      className={`cursor-pointer ${isSelected ? 'bg-muted/50' : ''}`}
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
                          <div className="font-medium">
                            {formatDate(entry.timesheet?.week_start)}
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
                      <TableCell className="text-right font-mono hidden sm:table-cell">
                        {formatCurrency(rate)}
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
