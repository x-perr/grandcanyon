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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveExpenseEntry } from '@/app/(protected)/expenses/actions'
import { calculateExpenseTotals, formatCurrency } from '@/lib/validations/expense'
import { toast } from 'sonner'
import type { ExpenseEntryWithRelations, ExpenseType, ProjectForExpense } from '@/app/(protected)/expenses/actions'

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
      }
    }
  }, [open, entry, weekStart])

  // Get tasks for selected project
  const selectedProject = projects.find((p) => p.id === projectId)
  const tasks = selectedProject?.tasks ?? []

  // Get default rate from selected expense type
  const selectedExpenseType = expenseTypes.find((t) => t.id === expenseTypeId)

  // Auto-fill unit price when expense type changes (if it has a default rate)
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
      toast.error('Please fill in all required fields')
      return
    }

    startTransition(async () => {
      const result = await saveExpenseEntry(expenseId, {
        id: entry?.id,
        expense_type_id: expenseTypeId,
        project_id: projectId,
        task_id: taskId || null,
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
        toast.success(entry ? 'Entry updated' : 'Entry added')
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
            <DialogTitle>{entry ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            <DialogDescription>
              {entry ? 'Update the expense entry details.' : 'Add a new expense entry for this week.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Expense Type */}
            <div className="grid gap-2">
              <Label htmlFor="expenseType">Expense Type *</Label>
              <Select value={expenseTypeId} onValueChange={setExpenseTypeId}>
                <SelectTrigger id="expenseType">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                      {type.default_rate && (
                        <span className="ml-2 text-muted-foreground">
                          ({formatCurrency(type.default_rate)}/unit)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project */}
            <div className="grid gap-2">
              <Label htmlFor="project">Project *</Label>
              <Select value={projectId} onValueChange={(v) => { setProjectId(v); setTaskId(''); }}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.code} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task (Optional) */}
            {tasks.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="task">Task (Optional)</Label>
                <Select value={taskId} onValueChange={setTaskId}>
                  <SelectTrigger id="task">
                    <SelectValue placeholder="Select task..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.code} - {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date */}
            <div className="grid gap-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was this expense for?"
                required
              />
            </div>

            {/* Receipt Number */}
            <div className="grid gap-2">
              <Label htmlFor="receipt">Receipt # (Optional)</Label>
              <Input
                id="receipt"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="INV-12345"
              />
            </div>

            {/* Quantity and Unit Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unitPrice">Unit Price *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Totals Display */}
            <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST (5%):</span>
                <span className="font-mono">{formatCurrency(totals.gst_amount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>QST (9.975%):</span>
                <span className="font-mono">{formatCurrency(totals.qst_amount)}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-1 mt-1">
                <span>Total:</span>
                <span className="font-mono">{formatCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Billable Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="billable"
                checked={isBillable}
                onCheckedChange={(checked) => setIsBillable(checked === true)}
              />
              <Label htmlFor="billable" className="text-sm font-normal">
                Billable to client
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : entry ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
