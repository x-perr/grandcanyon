'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ArrowUp, Loader2 } from 'lucide-react'
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
import { advanceClassification } from '@/lib/billing/progression'
import type { AdvancementAlert } from '@/types/billing'

interface AdvancementAlertsProps {
  alerts: AdvancementAlert[]
}

export function AdvancementAlerts({ alerts }: AdvancementAlertsProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [advancingAlert, setAdvancingAlert] = useState<AdvancementAlert | null>(null)
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [isPending, startTransition] = useTransition()

  const handleAdvance = () => {
    if (!advancingAlert || !advancingAlert.nextClassification) return

    startTransition(async () => {
      try {
        await advanceClassification({
          personId: advancingAlert.personId,
          newClassificationId: advancingAlert.nextClassification!.id,
          effectiveDate,
        })
        toast.success(t('billing.advancementSuccess'))
        setAdvancingAlert(null)
      } catch {
        toast.error(t('billing.advancementError'))
      }
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
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('billing.noAlerts')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('billing.advancement')}
            <Badge variant="secondary">{alerts.length}</Badge>
          </CardTitle>
          <CardDescription>{t('billing.advancementDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('billing.employeeName')}</TableHead>
                <TableHead>{t('billing.currentLevel')}</TableHead>
                <TableHead>{t('billing.nextLevel')}</TableHead>
                <TableHead>{t('billing.hoursProgress')}</TableHead>
                <TableHead>{t('billing.estimatedDate')}</TableHead>
                <TableHead className="text-right">{tCommon('labels.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.personId}>
                  <TableCell className="font-medium">
                    {alert.personName}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {alert.currentClassification.level}
                    </code>
                  </TableCell>
                  <TableCell>
                    {alert.nextClassification ? (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {alert.nextClassification.level}
                      </code>
                    ) : (
                      '-'
                    )}
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
                            className={`h-full rounded-full transition-all ${
                              alert.progressPercent >= 90
                                ? 'bg-red-500'
                                : alert.progressPercent >= 75
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${alert.progressPercent}%` }}
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

      {/* Advance Confirmation Dialog */}
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
    </>
  )
}
