import { getUserPermissions, hasPermission } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getClientsForInvoice, getProjectsForClient, getUninvoicedEntries, getNextInvoiceNumber } from '../actions'
import { InvoiceWizard } from '@/components/invoices/invoice-wizard'

interface NewInvoicePageProps {
  searchParams: Promise<{
    step?: string
    client_id?: string
    project_id?: string
    period_start?: string
    period_end?: string
    entries?: string
  }>
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const params = await searchParams
  const step = Number(params.step) || 1

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.edit')) {
    redirect('/invoices')
  }

  // Always load clients for step 1
  const clients = await getClientsForInvoice()

  // Load projects if client selected
  const projects = params.client_id ? await getProjectsForClient(params.client_id) : []

  // Load entries if project selected (for step 2+)
  const entries =
    params.project_id && step >= 2
      ? await getUninvoicedEntries(params.project_id, params.period_start, params.period_end)
      : []

  // Get next invoice number for step 3
  const nextInvoiceNumber = step >= 3 ? await getNextInvoiceNumber() : ''

  // Get client tax settings for step 3
  const selectedClient = clients.find((c) => c.id === params.client_id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
        <p className="text-muted-foreground">
          {step === 1 && 'Select a client and project'}
          {step === 2 && 'Select time entries to include'}
          {step === 3 && 'Review and create your invoice'}
        </p>
      </div>

      <InvoiceWizard
        step={step as 1 | 2 | 3}
        clients={clients}
        projects={projects}
        entries={entries}
        nextInvoiceNumber={nextInvoiceNumber}
        clientTaxSettings={
          selectedClient
            ? {
                charges_gst: selectedClient.charges_gst ?? true,
                charges_qst: selectedClient.charges_qst ?? true,
              }
            : undefined
        }
        initialValues={{
          client_id: params.client_id,
          project_id: params.project_id,
          period_start: params.period_start,
          period_end: params.period_end,
          selectedEntryIds: params.entries ? params.entries.split(',') : [],
        }}
      />
    </div>
  )
}
