'use client'

import { useState, useTransition, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ArrowUp, Loader2, Users, TrendingUp, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { advanceEmployeeClassification } from '@/app/(protected)/admin/actions/advancement'
import type { AdvancementAlert } from '@/types/billing'

type SortKey = 'name' | 'trade' | 'level' | 'progress' | 'date'
type SortDir = 'asc' | 'desc'

interface AdvancementAlertsProps {
  alerts: AdvancementAlert[]
}

export function AdvancementAlerts({ alerts }: AdvancementAlertsProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [advancingAlert, setAdvancingAlert] = useState<AdvancementAlert | null>(null)
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [isPending, startTransition] = useTransition()
  const [sortKey, setSortKey] = useState<SortKey>('progress')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Summary stats
  const totalApprentices = alerts.length
  const nearAdvancement = alerts.filter(
    (a) => a.progressPercent >= 80 && a.progressPercent < 100
  ).length
  const readyForAdvancement = alerts.filter(
    (a) => a.progressPercent >= 100
  ).length
  const readyAlerts = alerts.filter(
    (a) => a.progressPercent >= 100 && a.nextClassification
  )

  // Sorting
  const sortedAlerts = useMemo(() => {
    const sorted = [...alerts].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.personName.localeCompare(b.personName)
          break
        case 'trade':
          cmp = (a.currentClassification.trade?.name_fr ?? '').localeCompare(
            b.currentClassification.trade?.name_fr ?? ''
          )
          break
        case 'level':
          cmp = a.currentClassification.level.localeCompare(
            b.currentClassification.level
          )
          break
        case 'progress':
          cmp = a.progressPercent - b.progressPercent
          break
        case 'date':
          cmp = (a.estimatedAdvancementDate ?? '9999').localeCompare(
            b.estimatedAdvancementDate ?? '9999'
          )
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [alerts, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'progress' ? 'desc' : 'asc')
    }
  }

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-green-500'
    if (percent >= 80) return 'bg-green-500'
    if (percent >= 50) return 'bg-yellow-500'
    return 'bg-muted-foreground/40'
  }

  const handleAdvance = () => {
    if (!advancingAlert || !advancingAlert.nextClassification) return

    startTransition(async () => {
      try {
        const result = await advanceEmployeeClassification({
          personId: advancingAlert.personId,
          newClassificationId: advancingAlert.nextClassification!.id,
          effectiveDate,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(t('billing.advancementSuccess'))
          setAdvancingAlert(null)
        }
      } catch {
        toast.error(t('billing.advancementError'))
      }
    })
  }

  const handleBatchAdvance = () => {
    startTransition(async () => {
      let successCount = 0
      let errorCount = 0

      for (const alert of readyAlerts) {
        try {
          const result = await advanceEmployeeClassification({
            personId: alert.personId,
            newClassificationId: alert.nextClassification!.id,
            effectiveDate,
          })
          if (result.error) {
            errorCount++
          } else {
            successCount++
          }
        } catch {
          errorCount++
        }
      }

      if (errorCount === 0) {
        toast.success(t('billing.advancementSuccess'))
      } else {
        toast.error(
          `${successCount} advanced, ${errorCount} failed`
        )
      }
      setBatchConfirmOpen(false)
    })
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('billing.advancement')}
          </CardTitle>
          <CardDescription>{t('billing.advancementDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-8">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm text-muted-foreground">
              {t('billing.allOnTrack')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('billing.totalApprentices')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApprentices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('billing.nearAdvancement')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nearAdvancement}</div>
            <p className="text-xs text-muted-foreground">&gt;80%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('billing.readyForAdvancement')}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readyForAdvancement}</div>
            <p className="text-xs text-muted-foreground">&ge;100%</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {t('billing.advancement')}
                <Badge variant="secondary">{alerts.length}</Badge>
              </CardTitle>
              <CardDescription>{t('billing.advancementDescription')}</CardDescription>
            </div>
            {readyAlerts.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setBatchConfirmOpen(true)}
                disabled={isPending}
              >
                <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                {t('billing.advanceAll')} ({readyAlerts.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('name')}
                >
                  {t('billing.employeeName')}{getSortIndicator('name')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('trade')}
                >
                  {t('billing.trade')}{getSortIndicator('trade')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('level')}
                >
                  {t('billing.currentLevel')}{getSortIndicator('level')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('progress')}
                >
                  {t('billing.hoursProgress')}{getSortIndicator('progress')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('date')}
                >
                  {t('billing.estimatedDate')}{getSortIndicator('date')}
                </TableHead>
                <TableHead className="text-right">{tCommon('labels.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAlerts.map((alert) => (
                <TableRow key={alert.personId}>
                  <TableCell className="font-medium">
                    {alert.personName}
                  </TableCell>
                  <TableCell>
                    {alert.currentClassification.trade?.name_fr ?? '-'}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {alert.currentClassification.level}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[180px]">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>
                            {Math.round(alert.hoursAccumulated)}/{alert.hoursRequired}h
                          </span>
                          <span>{alert.progressPercent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getProgressColor(alert.progressPercent)}`}
                            style={{ width: `${Math.min(100, alert.progressPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {alert.estimatedAdvancementDate ?? '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {alert.nextClassification && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAdvancingAlert(alert)}
                        disabled={alert.progressPercent < 100}
                      >
                        <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                        {t('billing.advance')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Advance Single Confirmation Dialog */}
      <AlertDialog
        open={!!advancingAlert}
        onOpenChange={() => setAdvancingAlert(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billing.advanceTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('billing.advanceMessage', {
                name: advancingAlert?.personName ?? '',
                from: advancingAlert?.currentClassification.level ?? '',
                to: advancingAlert?.nextClassification?.level ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="advance-date">{t('billing.effectiveDate')}</Label>
            <Input
              id="advance-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdvance} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('actions.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Advance Confirmation Dialog */}
      <AlertDialog
        open={batchConfirmOpen}
        onOpenChange={setBatchConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billing.advanceAllConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('billing.advanceAllConfirmMessage', {
                count: readyAlerts.length,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="batch-advance-date">{t('billing.effectiveDate')}</Label>
            <Input
              id="batch-advance-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchAdvance} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('actions.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
