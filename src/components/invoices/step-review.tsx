'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, type TaxCalculation } from '@/lib/tax'
import { FileText, Building2, FolderKanban } from 'lucide-react'
import type { InvoiceLineFormData } from '@/lib/validations/invoice'
import type { ClientForSelect, ProjectForSelect } from '@/app/(protected)/invoices/actions'
import { useTranslations } from 'next-intl'

interface StepReviewProps {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  onInvoiceDateChange: (date: string) => void
  onDueDateChange: (date: string) => void
  notes: string
  onNotesChange: (notes: string) => void
  lines: InvoiceLineFormData[]
  totals: TaxCalculation
  clientTaxSettings?: {
    charges_gst: boolean
    charges_qst: boolean
  }
  client?: ClientForSelect
  project?: ProjectForSelect
}

export function StepReview({
  invoiceNumber,
  invoiceDate,
  dueDate,
  onInvoiceDateChange,
  onDueDateChange,
  notes,
  onNotesChange,
  lines,
  totals,
  clientTaxSettings,
  client,
  project,
}: StepReviewProps) {
  const t = useTranslations('invoices')
  const tc = useTranslations('common')

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t('wizard.step3_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('wizard.step3_desc')}
        </p>
      </div>

      {/* Invoice Header */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Invoice Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {t('wizard.invoice_details')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">{t('wizard.invoice_number')}</Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                disabled
                className="bg-muted font-mono"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice_date">{t('wizard.invoice_date')}</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => onInvoiceDateChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">{t('wizard.due_date')}</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => onDueDateChange(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bill To */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              {t('detail.bill_to')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {client ? (
              <div className="space-y-1">
                <div className="font-semibold">{client.name}</div>
                <div className="text-sm text-muted-foreground">{client.code}</div>
                {project && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{project.name}</span>
                      <span className="text-muted-foreground">({project.code})</span>
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">{t('detail.tax_settings')}:</div>
                  <div>
                    {clientTaxSettings?.charges_gst !== false ? t('detail.gst') : 'No GST'}
                    {' + '}
                    {clientTaxSettings?.charges_qst !== false ? t('detail.qst') : 'No QST'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">{t('wizard.no_client_selected')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('wizard.line_items')}</CardTitle>
          <CardDescription>{t('wizard.items_to_bill')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">{tc('labels.description')}</TableHead>
                  <TableHead className="text-right">{tc('labels.quantity')}</TableHead>
                  <TableHead className="text-right">{tc('labels.rate')}</TableHead>
                  <TableHead className="text-right">{tc('labels.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell>{line.description}</TableCell>
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
                    {t('detail.subtotal')}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(totals.subtotal)}
                  </TableCell>
                </TableRow>
                {clientTaxSettings?.charges_gst !== false && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-right text-muted-foreground">
                      {t('detail.gst')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(totals.gst)}
                    </TableCell>
                  </TableRow>
                )}
                {clientTaxSettings?.charges_qst !== false && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-right text-muted-foreground">
                      {t('detail.qst')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(totals.qst)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={3} className="text-right font-semibold">
                    {t('detail.total')}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-lg">
                    {formatCurrency(totals.total)}
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
          <CardTitle className="text-base">{t('wizard.notes')}</CardTitle>
          <CardDescription>{t('wizard.notes_optional')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={t('wizard.notes_placeholder')}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-700">{formatCurrency(totals.total)}</div>
            <div className="text-sm text-green-600 mt-1">
              {t('wizard.invoice_summary', { number: invoiceNumber, count: lines.length })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
