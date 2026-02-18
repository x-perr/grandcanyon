import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  FolderKanban,
  Pencil,
  FileDown,
  Send,
  CheckCircle,
  XCircle,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { getInvoice } from '../actions'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { formatCurrency } from '@/lib/tax'
import { InvoiceActions } from '@/components/invoices/invoice-actions'

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params
  const [invoice, permissions] = await Promise.all([getInvoice(id), getUserPermissions()])

  if (!invoice) {
    notFound()
  }

  const canEdit = hasPermission(permissions, 'invoices.edit')

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set'
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTime = (date: string | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Get line item description with employee name if from timesheet
  const getLineDescription = (line: NonNullable<typeof invoice.lines>[number]) => {
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

  const isDraft = invoice.status === 'draft'
  const isSent = invoice.status === 'sent'
  const isPaid = invoice.status === 'paid'
  const isVoid = invoice.status === 'void'

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold">{invoice.invoice_number}</span>
              <StatusBadge status={invoice.status ?? 'draft'} />
            </div>
            <h1 className="text-xl font-bold">
              {invoice.client?.name ?? 'Unknown Client'}
            </h1>
            {invoice.project && (
              <Link
                href={`/projects/${invoice.project.id}`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <FolderKanban className="h-3.5 w-3.5" />
                {invoice.project.code} - {invoice.project.name}
              </Link>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* PDF Download - always available */}
          <Button variant="outline" asChild>
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>

          {/* Edit button - draft only */}
          {canEdit && isDraft && (
            <Button asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}

          {/* Actions dropdown - for status changes */}
          {canEdit && !isPaid && !isVoid && invoice.status && (
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
            />
          )}
        </div>
      </div>

      {/* Total banner */}
      <Card className={isPaid ? 'border-green-200 bg-green-50' : isSent ? 'border-blue-200 bg-blue-50' : ''}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isPaid ? 'text-green-600' : isSent ? 'text-blue-600' : 'text-muted-foreground'}`}>
                {isPaid ? 'Paid' : isSent ? 'Amount Due' : 'Draft Total'}
              </p>
              <p className={`text-3xl font-bold ${isPaid ? 'text-green-700' : isSent ? 'text-blue-700' : ''}`}>
                {formatCurrency(invoice.total)}
              </p>
            </div>
            {isSent && invoice.due_date && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">{formatDate(invoice.due_date)}</p>
              </div>
            )}
            {isPaid && invoice.paid_at && (
              <div className="text-right">
                <p className="text-sm text-green-600">Paid On</p>
                <p className="font-medium text-green-700">{formatDate(invoice.paid_at)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="lines">Line Items ({invoice.lines?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Invoice Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Invoice Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Invoice Number</span>
                  <span className="font-mono font-medium">{invoice.invoice_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span>{formatDate(invoice.invoice_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{formatDate(invoice.due_date)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Billing Period</span>
                  <span>
                    {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                  </span>
                </div>
                {invoice.sent_at && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Sent</span>
                    <span>{formatDateTime(invoice.sent_at)}</span>
                  </div>
                )}
                {invoice.paid_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-green-600 font-medium">{formatDateTime(invoice.paid_at)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bill To */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Bill To
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice.client ? (
                  <>
                    <div>
                      <Link
                        href={`/clients/${invoice.client.id}`}
                        className="font-semibold hover:underline"
                      >
                        {invoice.client.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{invoice.client.code}</p>
                    </div>

                    {/* Client Address */}
                    {(invoice.client.address || invoice.client.city) && (
                      <div className="text-sm">
                        {invoice.client.address && <p>{invoice.client.address}</p>}
                        {(invoice.client.city || invoice.client.province || invoice.client.postal_code) && (
                          <p>
                            {[invoice.client.city, invoice.client.province, invoice.client.postal_code]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Project */}
                    {invoice.project && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 text-sm">
                          <FolderKanban className="h-4 w-4 text-muted-foreground" />
                          <Link
                            href={`/projects/${invoice.project.id}`}
                            className="font-medium hover:underline"
                          >
                            {invoice.project.name}
                          </Link>
                          <span className="text-muted-foreground">({invoice.project.code})</span>
                        </div>
                      </div>
                    )}

                    {/* Tax Settings */}
                    <div className="pt-3 border-t text-sm">
                      <p className="font-medium">Tax Settings</p>
                      <p className="text-muted-foreground">
                        {invoice.client.charges_gst !== false ? 'GST (5%)' : 'No GST'}
                        {' + '}
                        {invoice.client.charges_qst !== false ? 'QST (9.975%)' : 'No QST'}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Client information not available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Line Items Tab */}
        <TabsContent value="lines" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>
                {invoice.lines?.length ?? 0} item{(invoice.lines?.length ?? 0) !== 1 ? 's' : ''} totaling{' '}
                {formatCurrency(invoice.subtotal)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
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
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(invoice.subtotal)}
                      </TableCell>
                    </TableRow>
                    {invoice.client?.charges_gst !== false && (invoice.gst_amount ?? 0) > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-right text-muted-foreground">
                          GST (5%)
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(invoice.gst_amount ?? 0)}
                        </TableCell>
                      </TableRow>
                    )}
                    {invoice.client?.charges_qst !== false && (invoice.qst_amount ?? 0) > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-right text-muted-foreground">
                          QST (9.975%)
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(invoice.qst_amount ?? 0)}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={3} className="text-right font-semibold">
                        Total
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

          {/* Notes in line items tab too */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
