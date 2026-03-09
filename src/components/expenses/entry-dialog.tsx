'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { saveExpenseEntry } from '@/app/(protected)/expenses/actions'
import { calculateExpenseTotals } from '@/lib/validations/expense'
import { toast } from 'sonner'
import type { ExpenseEntryWithRelations, ExpenseType, ProjectForExpense } from '@/app/(protected)/expenses/actions'
import { useTranslations } from 'next-intl'
import { ExpenseFormFields } from './expense-form-fields'

interface ExpenseEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expenseId: string
  entry: ExpenseEntryWithRelations | null
  projects: ProjectForExpense[]
  expenseTypes: ExpenseType[]
  weekStart: string
}

export function ExpenseEntryDialog({
  open,
  onOpenChange,
  expenseId,
  entry,
  projects,
  expenseTypes,
  weekStart,
}: ExpenseEntryDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('expenses')

  // Form state
  const [expenseTypeId, setExpenseTypeId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [expenseDate, setExpenseDate] = useState(weekStart)
  const [description, setDescription] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')
  const [isBillable, setIsBillable] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

  // Reset form when dialog opens/closes or entry changes
  useEffect(() => {
    if (open) {
      if (entry) {
        setExpenseTypeId(entry.expense_type_id ?? '')
        setProjectId(entry.project_id ?? '')
        setTaskId(entry.task_id ?? '')
        setExpenseDate(entry.expense_date)
        setDescription(entry.description ?? '')
        setReceiptNumber(entry.receipt_number ?? '')
        setQuantity(String(entry.quantity ?? 1))
        setUnitPrice(String(entry.unit_price ?? 0))
        setIsBillable(entry.is_billable ?? false)
        setReceiptUrl((entry as Record<string, unknown>).receipt_url as string ?? null)
      } else {
        setExpenseTypeId('')
        setProjectId('')
        setTaskId('')
        setExpenseDate(weekStart)
        setDescription('')
        setReceiptNumber('')
        setQuantity('1')
        setUnitPrice('0')
        setIsBillable(false)
        setReceiptUrl(null)
      }
    }
  }, [open, entry, weekStart])

  // Auto-fill unit price when expense type changes (if it has a default rate)
  const selectedExpenseType = expenseTypes.find((t) => t.id === expenseTypeId)
  useEffect(() => {
    if (selectedExpenseType?.default_rate && !entry) {
      setUnitPrice(String(selectedExpenseType.default_rate))
    }
  }, [expenseTypeId, selectedExpenseType, entry])

  // Calculate totals
  const qty = parseFloat(quantity) || 0
  const price = parseFloat(unitPrice) || 0
  const totals = calculateExpenseTotals(qty, price)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!expenseTypeId || !projectId || !description) {
      toast.error(t('entry.required_fields'))
      return
    }

    startTransition(async () => {
      const result = await saveExpenseEntry(expenseId, {
        id: entry?.id,
        expense_type_id: expenseTypeId,
        project_id: projectId,
        task_id: taskId && taskId !== 'none' ? taskId : null,
        expense_date: expenseDate,
        description,
        receipt_number: receiptNumber || null,
        quantity: qty,
        unit_price: price,
        is_billable: isBillable,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(entry ? t('entry.updated') : t('entry.added'))
        onOpenChange(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{entry ? t('entry.edit_expense') : t('entry.add_expense')}</DialogTitle>
            <DialogDescription>
              {entry ? t('entry.edit_desc') : t('entry.add_desc')}
            </DialogDescription>
          </DialogHeader>

          <ExpenseFormFields
            expenseTypeId={expenseTypeId}
            onExpenseTypeIdChange={setExpenseTypeId}
            projectId={projectId}
            onProjectIdChange={setProjectId}
            taskId={taskId}
            onTaskIdChange={setTaskId}
            expenseDate={expenseDate}
            onExpenseDateChange={setExpenseDate}
            description={description}
            onDescriptionChange={setDescription}
            receiptNumber={receiptNumber}
            onReceiptNumberChange={setReceiptNumber}
            quantity={quantity}
            onQuantityChange={setQuantity}
            unitPrice={unitPrice}
            onUnitPriceChange={setUnitPrice}
            isBillable={isBillable}
            onIsBillableChange={setIsBillable}
            receiptUrl={receiptUrl}
            onReceiptUrlChange={setReceiptUrl}
            entryId={entry?.id}
            projects={projects}
            expenseTypes={expenseTypes}
            totals={totals}
            t={t}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('entry.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('entry.saving') : entry ? t('entry.update') : t('entry.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
