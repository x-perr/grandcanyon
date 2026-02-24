'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, FileText, Building2, FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/tax'
import { updateInvoice } from '@/app/(protected)/invoices/actions'
import type { InvoiceWithRelations } from '@/app/(protected)/invoices/actions'
import { useTranslations } from 'next-intl'

interface InvoiceEditFormProps {
  invoice: InvoiceWithRelations
}

export function InvoiceEditForm({ invoice }: InvoiceEditFormProps) {
  const router = useRouter()
  const t = useTranslations('invoices')
  const tc = useTranslations('common')

  const handleSubmit = async (_prevState: unknown, formData: FormData) => {
    const data = {
      invoice_date: formData.get('invoice_date') as string,
      due_date: formData.get('due_date') as string,
      period_start: formData.get('period_start') as string,
      period_end: formData.get('period_end') as string,
      notes: formData.get('notes') as string || null,
    }

    const result = await updateInvoice(invoice.id, data)

    if (result?.error) {
      return { error: result.error }
    }

    router.push(`/invoices/${invoice.id}`)
    return { success: true }
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, undefined)

  // Get line item description with employee name if from timesheet
  const getLineDescription = (line: NonNullable<InvoiceWithRelations['lines']>[number]) => {
    const entry = Array.isArray(line.timesheet_entry) ? line.timesheet_entry[0] : line.timesheet_entry
    if (entry?.timesheet) {
      const ts = Array.isArray(entry.timesheet) ? entry.timesheet[0] : entry.timesheet
      const user = ts?.user ? (Array.isArray(ts.user) ? ts.user[0] : ts.user) : null
      if (user) {
        return `${line.description} - ${user.first_name} ${user.last_name}`
      }
    }
    return line.description
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/invoices/${invoice.id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('detail.back_to_invoice')}
        </Link>
      </Button>

      {/* Error display */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Invoice Header Info (read-only) */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {t('detail.invoice_details')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('detail.invoice_number')}</Label>
              <Input value={invoice.invoice_number} disabled className="bg-muted font-mono" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice_date">{t('detail.invoice_date')}</Label>
                <Input
                  id="invoice_date"
                  name="invoice_date"
                  type="date"
                  defaultValue={invoice.invoice_date}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">{t('detail.due_date')}</Label>
                <Input
                  id="due_date"
                  name="due_date"
                  type="date"
                  defaultValue={invoice.due_date ?? ''}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="period_start">{t('detail.period_start')}</Label>
                <Input
                  id="period_start"
                  name="period_start"
                  type="date"
                  defaultValue={invoice.period_start}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_end">{t('detail.period_end')}</Label>
                <Input
                  id="period_end"
                  name="period_end"
                  type="date"
                  defaultValue={invoice.period_end}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bill To (read-only) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              {t('detail.bill_to')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.client ? (
              <div className="space-y-1">
                <div className="font-semibold">{invoice.client.name}</div>
                <div className="text-sm text-muted-foreground">{invoice.client.code}</div>
                {invoice.project && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{invoice.project.name}</span>
                      <span className="text-muted-foreground">({invoice.project.code})</span>
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">{t('detail.tax_settings')}:</div>
                  <div>
                    {invoice.client.charges_gst !== false ? t('detail.gst') : t('detail.no_gst')}
                    {' + '}
                    {invoice.client.charges_qst !== false ? t('detail.qst') : t('detail.no_qst')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">{t('detail.no_client')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items (read-only for now) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('detail.line_items')}</CardTitle>
          <CardDescription>
            {t('edit.line_items_readonly')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">{tc('labels.description')}</TableHead>
                  <TableHead className="text-right">{tc('labels.qty')}</TableHead>
                  <TableHead className="text-right">{tc('labels.rate')}</TableHead>
                  <TableHead className="text-right">{tc('labels.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoice.lines ?? []).map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{getLineDescription(line)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.quantity.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(line.unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(line.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right">
                    {tc('labels.subtotal')}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(invoice.subtotal)}
                  </TableCell>
                </TableRow>
                {invoice.client?.charges_gst !== false && (invoice.gst_amount ?? 0) > 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-right text-muted-foreground">
                      {t('detail.gst')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(invoice.gst_amount ?? 0)}
                    </TableCell>
                  </TableRow>
                )}
                {invoice.client?.charges_qst !== false && (invoice.qst_amount ?? 0) > 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-right text-muted-foreground">
                      {t('detail.qst')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(invoice.qst_amount ?? 0)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={3} className="text-right font-semibold">
                    {tc('labels.total')}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-lg">
                    {formatCurrency(invoice.total)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tc('labels.notes')}</CardTitle>
          <CardDescription>{t('edit.notes_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            name="notes"
            placeholder={t('edit.notes_placeholder')}
            defaultValue={invoice.notes ?? ''}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" asChild>
          <Link href={`/invoices/${invoice.id}`}>{tc('actions.cancel')}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tc('actions.save_changes')}
        </Button>
      </div>
    </form>
  )
}
