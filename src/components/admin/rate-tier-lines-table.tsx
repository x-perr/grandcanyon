'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { toast } from 'sonner'
import {
  upsertRateTierLine,
  deleteRateTierLine,
} from '@/app/(protected)/admin/rate-tiers/actions'
import type { RateTierLine, CcqClassification } from '@/types/billing'

interface RateTierLinesTableProps {
  tierId: string
  lines: RateTierLine[]
  classifications: CcqClassification[]
}

export function RateTierLinesTable({
  tierId,
  lines,
  classifications,
}: RateTierLinesTableProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<RateTierLine | null>(null)
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleUpsert = (formData: FormData) => {
    startTransition(async () => {
      const result = await upsertRateTierLine(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          editingLine
            ? t('billing.lineUpdated')
            : t('billing.lineCreated')
        )
        setIsAddOpen(false)
        setEditingLine(null)
      }
    })
  }

  const handleDelete = () => {
    if (!deletingLineId) return
    startTransition(async () => {
      const result = await deleteRateTierLine(deletingLineId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('billing.lineDeleted'))
        setDeletingLineId(null)
      }
    })
  }

  const getClassificationLabel = (classification?: CcqClassification) => {
    if (!classification) return '-'
    const trade = classification.trade
    const tradeName = trade?.name_en ?? trade?.code ?? ''
    return `${tradeName} - ${classification.name_en}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('billing.rateTierLines')}</h4>
        <Button size="sm" variant="outline" onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          {t('billing.addLine')}
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t('billing.noLines')}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('billing.classification')}</TableHead>
              <TableHead className="text-right">{t('billing.hourlyRate')}</TableHead>
              <TableHead>{t('billing.effectiveDate')}</TableHead>
              <TableHead>{t('billing.notes')}</TableHead>
              <TableHead className="text-right w-[100px]">{tCommon('labels.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  {getClassificationLabel(line.classification)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${line.hourly_rate.toFixed(2)}
                </TableCell>
                <TableCell>{line.effective_date}</TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {line.notes || '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingLine(line)}
                      title={tCommon('actions.edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeletingLineId(line.id)}
                      title={tCommon('actions.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit Line Dialog */}
      <Dialog
        open={isAddOpen || !!editingLine}
        onOpenChange={() => {
          setIsAddOpen(false)
          setEditingLine(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLine ? t('billing.editLine') : t('billing.addLine')}
            </DialogTitle>
            <DialogDescription>
              {editingLine
                ? t('billing.editLineDescription')
                : t('billing.addLineDescription')}
            </DialogDescription>
          </DialogHeader>
          <form action={handleUpsert}>
            <input type="hidden" name="tier_id" value={tierId} />
            {editingLine && (
              <input type="hidden" name="id" value={editingLine.id} />
            )}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="line-classification">{t('billing.classification')}</Label>
                <Select
                  name="classification_id"
                  defaultValue={editingLine?.classification_id ?? ''}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('billing.selectClassification')} />
                  </SelectTrigger>
                  <SelectContent>
                    {classifications.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {getClassificationLabel(cls)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="line-rate">{t('billing.hourlyRate')}</Label>
                  <Input
                    id="line-rate"
                    name="hourly_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="999.99"
                    defaultValue={editingLine?.hourly_rate ?? ''}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="line-date">{t('billing.effectiveDate')}</Label>
                  <Input
                    id="line-date"
                    name="effective_date"
                    type="date"
                    defaultValue={editingLine?.effective_date ?? ''}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="line-notes">{t('billing.notes')}</Label>
                <Input
                  id="line-notes"
                  name="notes"
                  defaultValue={editingLine?.notes ?? ''}
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
                  setIsAddOpen(false)
                  setEditingLine(null)
                }}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {tCommon('actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingLineId} onOpenChange={() => setDeletingLineId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billing.deleteLineTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('billing.deleteLineMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
