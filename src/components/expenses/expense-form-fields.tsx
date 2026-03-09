'use client'

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
import { formatCurrency } from '@/lib/validations/expense'
import { ExpenseReceiptSection } from './expense-receipt-section'
import type { ExpenseType, ProjectForExpense } from '@/app/(protected)/expenses/actions'
import type { useTranslations } from 'next-intl'

interface ExpenseFormFieldsProps {
  expenseTypeId: string
  onExpenseTypeIdChange: (value: string) => void
  projectId: string
  onProjectIdChange: (value: string) => void
  taskId: string
  onTaskIdChange: (value: string) => void
  expenseDate: string
  onExpenseDateChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  receiptNumber: string
  onReceiptNumberChange: (value: string) => void
  quantity: string
  onQuantityChange: (value: string) => void
  unitPrice: string
  onUnitPriceChange: (value: string) => void
  isBillable: boolean
  onIsBillableChange: (value: boolean) => void
  receiptUrl: string | null
  onReceiptUrlChange: (url: string | null) => void
  entryId: string | undefined
  projects: ProjectForExpense[]
  expenseTypes: ExpenseType[]
  totals: { subtotal: number; gst_amount: number; qst_amount: number; total: number }
  t: ReturnType<typeof useTranslations<'expenses'>>
}

export function ExpenseFormFields({
  expenseTypeId,
  onExpenseTypeIdChange,
  projectId,
  onProjectIdChange,
  taskId,
  onTaskIdChange,
  expenseDate,
  onExpenseDateChange,
  description,
  onDescriptionChange,
  receiptNumber,
  onReceiptNumberChange,
  quantity,
  onQuantityChange,
  unitPrice,
  onUnitPriceChange,
  isBillable,
  onIsBillableChange,
  receiptUrl,
  onReceiptUrlChange,
  entryId,
  projects,
  expenseTypes,
  totals,
  t,
}: ExpenseFormFieldsProps) {
  const selectedProject = projects.find((p) => p.id === projectId)
  const tasks = selectedProject?.tasks ?? []

  return (
    <div className="grid gap-4 py-4">
      {/* Expense Type */}
      <div className="grid gap-2">
        <Label htmlFor="expenseType">{t('entry.expense_type_required')}</Label>
        <Select value={expenseTypeId} onValueChange={onExpenseTypeIdChange}>
          <SelectTrigger id="expenseType">
            <SelectValue placeholder={t('entry.select_type_placeholder')} />
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
        <Label htmlFor="project">{t('entry.project_required')}</Label>
        <Select value={projectId} onValueChange={(v) => { onProjectIdChange(v); onTaskIdChange(''); }}>
          <SelectTrigger id="project">
            <SelectValue placeholder={t('entry.select_project_placeholder')} />
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
          <Label htmlFor="task">{t('entry.task_optional')}</Label>
          <Select value={taskId} onValueChange={onTaskIdChange}>
            <SelectTrigger id="task">
              <SelectValue placeholder={t('entry.select_task')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('entry.task_none')}</SelectItem>
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
        <Label htmlFor="date">{t('entry.date_required')}</Label>
        <Input
          id="date"
          type="date"
          value={expenseDate}
          onChange={(e) => onExpenseDateChange(e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <Label htmlFor="description">{t('entry.description_required')}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t('entry.description_placeholder')}
          required
        />
      </div>

      {/* Receipt Number */}
      <div className="grid gap-2">
        <Label htmlFor="receipt">{t('entry.receipt_optional')}</Label>
        <Input
          id="receipt"
          value={receiptNumber}
          onChange={(e) => onReceiptNumberChange(e.target.value)}
          placeholder={t('entry.receipt_number_placeholder')}
        />
      </div>

      {/* Receipt Image - only show for existing entries */}
      {entryId && (
        <ExpenseReceiptSection
          entryId={entryId}
          receiptUrl={receiptUrl}
          onReceiptUrlChange={onReceiptUrlChange}
          t={t}
        />
      )}

      {/* Quantity and Unit Price */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="quantity">{t('entry.quantity_required')}</Label>
          <Input
            id="quantity"
            type="number"
            step="0.01"
            min="0.01"
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unitPrice">{t('entry.unit_price_required')}</Label>
          <Input
            id="unitPrice"
            type="number"
            step="0.01"
            min="0"
            value={unitPrice}
            onChange={(e) => onUnitPriceChange(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Totals Display */}
      <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>{t('entry.subtotal')}</span>
          <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t('entry.gst_5')}</span>
          <span className="font-mono">{formatCurrency(totals.gst_amount)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t('entry.qst_10')}</span>
          <span className="font-mono">{formatCurrency(totals.qst_amount)}</span>
        </div>
        <div className="flex justify-between font-medium border-t pt-1 mt-1">
          <span>{t('entry.total')}</span>
          <span className="font-mono">{formatCurrency(totals.total)}</span>
        </div>
      </div>

      {/* Billable Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="billable"
          checked={isBillable}
          onCheckedChange={(checked) => onIsBillableChange(checked === true)}
        />
        <Label htmlFor="billable" className="text-sm font-normal">
          {t('entry.billable')}
        </Label>
      </div>
    </div>
  )
}
