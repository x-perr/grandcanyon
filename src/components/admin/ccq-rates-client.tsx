'use client'

import { useState, useMemo, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Loader2, Save } from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { upsertCcqRate } from '@/app/(protected)/admin/ccq-rates/actions'
import type { CcqTrade, CcqClassification, CcqRate } from '@/types/billing'

interface CcqRatesClientProps {
  trades: CcqTrade[]
  classifications: CcqClassification[]
  rates: CcqRate[]
}

export function CcqRatesClient({
  trades,
  classifications,
  rates,
}: CcqRatesClientProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [editingRate, setEditingRate] = useState<CcqRate | null>(null)
  const [addingForClassificationId, setAddingForClassificationId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Group classifications by trade
  const classificationsByTrade = useMemo(() => {
    const map = new Map<string, CcqClassification[]>()
    for (const cls of classifications) {
      const existing = map.get(cls.trade_id) ?? []
      existing.push(cls)
      map.set(cls.trade_id, existing)
    }
    return map
  }, [classifications])

  // Build a map of classification_id -> most recent rate
  const currentRateMap = useMemo(() => {
    const map = new Map<string, CcqRate>()
    for (const rate of rates) {
      const existing = map.get(rate.classification_id)
      if (!existing || rate.effective_from > existing.effective_from) {
        map.set(rate.classification_id, rate)
      }
    }
    return map
  }, [rates])

  const handleUpsert = (formData: FormData) => {
    startTransition(async () => {
      const result = await upsertCcqRate(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          editingRate
            ? t('billing.rateUpdated')
            : t('billing.rateCreated')
        )
        setEditingRate(null)
        setAddingForClassificationId(null)
      }
    })
  }

  const getTradeLabel = (trade: CcqTrade) => {
    return trade.name_en || trade.name_fr || trade.code
  }

  return (
    <div className="space-y-6">
      {trades.map((trade) => {
        const tradeClassifications = classificationsByTrade.get(trade.id) ?? []
        if (tradeClassifications.length === 0) return null

        return (
          <Card key={trade.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {getTradeLabel(trade)}
                    <Badge variant="outline" className="text-xs font-normal">
                      {trade.code}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {t('billing.classificationsCount', {
                      count: tradeClassifications.length,
                    })}
                  </CardDescription>
                </div>
                {!trade.is_active && (
                  <Badge variant="secondary">{tCommon('status.inactive')}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('billing.classification')}</TableHead>
                    <TableHead>{t('billing.level')}</TableHead>
                    <TableHead className="text-right">
                      {t('billing.hourlyRate')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('billing.vacationPercent')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('billing.benefitRate')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('billing.totalCost')}
                    </TableHead>
                    <TableHead>{t('billing.effectiveDate')}</TableHead>
                    <TableHead className="text-right w-[100px]">
                      {tCommon('labels.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tradeClassifications.map((cls) => {
                    const currentRate = currentRateMap.get(cls.id)
                    return (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">
                          {cls.name_en || cls.name_fr}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {cls.level}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {currentRate
                            ? `$${currentRate.hourly_rate.toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {currentRate?.vacation_percent != null
                            ? `${currentRate.vacation_percent}%`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {currentRate?.benefit_rate != null
                            ? `$${currentRate.benefit_rate.toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {currentRate?.total_hourly_cost != null
                            ? `$${currentRate.total_hourly_cost.toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {currentRate?.effective_from ?? '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {currentRate ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingRate(currentRate)}
                                title={tCommon('actions.edit')}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  setAddingForClassificationId(cls.id)
                                }
                                title={tCommon('actions.add')}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}

      {/* Add/Edit Rate Dialog */}
      <Dialog
        open={!!editingRate || !!addingForClassificationId}
        onOpenChange={() => {
          setEditingRate(null)
          setAddingForClassificationId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRate
                ? t('billing.editRate')
                : t('billing.addRate')}
            </DialogTitle>
            <DialogDescription>
              {editingRate
                ? t('billing.editRateDescription')
                : t('billing.addRateDescription')}
            </DialogDescription>
          </DialogHeader>
          <form action={handleUpsert}>
            {editingRate && (
              <input type="hidden" name="id" value={editingRate.id} />
            )}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate-classification">
                  {t('billing.classification')}
                </Label>
                {editingRate || addingForClassificationId ? (
                  <>
                    <input
                      type="hidden"
                      name="classification_id"
                      value={
                        editingRate?.classification_id ??
                        addingForClassificationId ??
                        ''
                      }
                    />
                    <Input
                      disabled
                      value={(() => {
                        const clsId =
                          editingRate?.classification_id ??
                          addingForClassificationId
                        const cls = classifications.find((c) => c.id === clsId)
                        return cls
                          ? `${cls.name_en || cls.name_fr} (${cls.level})`
                          : ''
                      })()}
                    />
                  </>
                ) : (
                  <Select name="classification_id" required>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('billing.selectClassification')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {classifications.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name_en || cls.name_fr} ({cls.level})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rate-hourly">{t('billing.hourlyRate')}</Label>
                  <Input
                    id="rate-hourly"
                    name="hourly_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="999.99"
                    defaultValue={editingRate?.hourly_rate ?? ''}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate-effective">
                    {t('billing.effectiveFrom')}
                  </Label>
                  <Input
                    id="rate-effective"
                    name="effective_from"
                    type="date"
                    defaultValue={editingRate?.effective_from ?? ''}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="rate-vacation">
                    {t('billing.vacationPercent')}
                  </Label>
                  <Input
                    id="rate-vacation"
                    name="vacation_percent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue={editingRate?.vacation_percent ?? ''}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate-benefit">
                    {t('billing.benefitRate')}
                  </Label>
                  <Input
                    id="rate-benefit"
                    name="benefit_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="999.99"
                    defaultValue={editingRate?.benefit_rate ?? ''}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate-total">{t('billing.totalCost')}</Label>
                  <Input
                    id="rate-total"
                    name="total_hourly_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    max="9999.99"
                    defaultValue={editingRate?.total_hourly_cost ?? ''}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate-effective-to">
                  {t('billing.effectiveTo')}
                </Label>
                <Input
                  id="rate-effective-to"
                  name="effective_to"
                  type="date"
                  defaultValue={editingRate?.effective_to ?? ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate-notes">{t('billing.notes')}</Label>
                <Input
                  id="rate-notes"
                  name="notes"
                  defaultValue={editingRate?.notes ?? ''}
                  maxLength={500}
                  placeholder={t('billing.notesPlaceholder')}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingRate(null)
                  setAddingForClassificationId(null)
                }}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                {tCommon('actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
