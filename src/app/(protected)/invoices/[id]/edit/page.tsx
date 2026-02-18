import { notFound, redirect } from 'next/navigation'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getInvoice } from '../../actions'
import { InvoiceEditForm } from '@/components/invoices/invoice-edit-form'

interface EditInvoicePageProps {
  params: Promise<{ id: string }>
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params
  const permissions = await getUserPermissions()

  if (!hasPermission(permissions, 'invoices.edit')) {
    redirect('/invoices')
  }

  const invoice = await getInvoice(id)

  if (!invoice) {
    notFound()
  }

  // Only draft invoices can be edited
  if (invoice.status !== 'draft') {
    redirect(`/invoices/${id}`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Invoice</h1>
        <p className="text-muted-foreground">
          Update invoice {invoice.invoice_number} for {invoice.client?.name ?? 'Unknown Client'}
        </p>
      </div>

      <InvoiceEditForm invoice={invoice} />
    </div>
  )
}
