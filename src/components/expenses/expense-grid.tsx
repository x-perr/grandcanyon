'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { ExpenseEntryDialog } from './entry-dialog'
import { deleteExpenseEntry } from '@/app/(protected)/expenses/actions'
import { formatCurrency } from '@/lib/validations/expense'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'
import type { ExpenseEntryWithRelations, ExpenseType, ProjectForExpense } from '@/app/(protected)/expenses/actions'

interface ExpenseGridProps {
  expense: Tables<'expenses'>
  entries: ExpenseEntryWithRelations[]
  projects: ProjectForExpense[]
  expenseTypes: ExpenseType[]
  weekStart: string
  isEditable: boolean
}

export function ExpenseGrid({
  expense,
  entries,
  projects,
  expenseTypes,
  weekStart,
  isEditable,
}: ExpenseGridProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ExpenseEntryWithRelations | null>(null)

  const handleDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this expense entry?')) {
      return
    }

    startTransition(async () => {
      const result = await deleteExpenseEntry(entryId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Entry deleted')
        router.refresh()
      }
    })
  }

  const handleEditEntry = (entry: ExpenseEntryWithRelations) => {
    setEditingEntry(entry)
    setIsDialogOpen(true)
  }

  const handleAddEntry = () => {
    setEditingEntry(null)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingEntry(null)
  }

  // Calculate totals
  const totalAmount = entries.reduce((sum, entry) => sum + (entry.total ?? 0), 0)
  const totalSubtotal = entries.reduce((sum, entry) => sum + (entry.subtotal ?? 0), 0)
  const totalGST = entries.reduce((sum, entry) => sum + (entry.gst_amount ?? 0), 0)
  const totalQST = entries.reduce((sum, entry) => sum + (entry.qst_amount ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Add Entry Button */}
      {isEditable && (
        <div className="flex justify-end">
          <Button onClick={handleAddEntry} disabled={isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      )}

      {/* Entry Dialog */}
      <ExpenseEntryDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        expenseId={expense.id}
        entry={editingEntry}
        projects={projects}
        expenseTypes={expenseTypes}
        weekStart={weekStart}
      />

      {/* Entries Table */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No expense entries yet.</p>
            {isEditable && (
              <Button onClick={handleAddEntry} variant="link" className="mt-2">
                Add your first expense
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="max-w-[200px]">Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">QST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Billable</TableHead>
                {isEditable && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={isEditable ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={() => isEditable && handleEditEntry(entry)}
                >
                  <TableCell className="whitespace-nowrap">
                    {new Date(entry.expense_date).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.expense_type?.name ?? '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.project?.code ?? '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {entry.description}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {entry.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.unit_price ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.subtotal ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatCurrency(entry.gst_amount ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatCurrency(entry.qst_amount ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(entry.total ?? 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.is_billable ? '✓' : ''}
                  </TableCell>
                  {isEditable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={6} className="text-right">
                  Totals:
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(totalSubtotal)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatCurrency(totalGST)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatCurrency(totalQST)}
                </TableCell>
                <TableCell className="text-right font-mono text-lg">
                  {formatCurrency(totalAmount)}
                </TableCell>
                <TableCell></TableCell>
                {isEditable && <TableCell></TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
