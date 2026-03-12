'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { formatCurrency } from '@/lib/tax'
import { sendInvoiceEmail, getEmailHistory } from '@/lib/email'
import type { InvoiceEmail } from './types'
import { getInvoice } from './queries'

/**
 * Get email history for an invoice (uses unified email_logs table)
 */
export async function getInvoiceEmails(invoiceId: string): Promise<InvoiceEmail[]> {
  const supabase = await createClient()

  // Use unified email_logs table with polymorphic relation
  const logs = await getEmailHistory('invoice', invoiceId)

  // Get sender names for the logs
  const senderIds = [...new Set(logs.map((log) => log.id))]
  if (senderIds.length === 0) return []

  // Fetch sender info from profiles using sent_by from email_logs
  const { data: logsWithSenders } = await supabase
    .from('email_logs')
    .select(
      `
      id,
      sent_by,
      metadata,
      sender:profiles!email_logs_sent_by_fkey(first_name, last_name)
    `
    )
    .eq('related_type', 'invoice')
    .eq('related_id', invoiceId)

  const senderMap = new Map<string, string>()
  for (const log of logsWithSenders ?? []) {
    const sender = Array.isArray(log.sender) ? log.sender[0] : log.sender
    if (sender) {
      senderMap.set(log.id, `${sender.first_name} ${sender.last_name}`)
    }
  }

  return logs.map((log) => {
    // Extract error from metadata if status is failed
    const metadata = (logsWithSenders?.find((l) => l.id === log.id)?.metadata ?? {}) as Record<string, unknown>
    const errorMessage = log.status === 'failed' ? (metadata.error as string) ?? null : null

    return {
      id: log.id,
      sent_to: log.recipient_email,
      sent_at: log.sent_at,
      status: log.status,
      error_message: errorMessage,
      sent_by_name: senderMap.get(log.id) ?? 'Unknown',
    }
  })
}

/**
 * Get client billing email for an invoice
 */
export async function getClientEmailForInvoice(invoiceId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('invoices')
    .select(
      `
      client:clients!invoices_client_id_fkey(
        billing_email,
        general_email
      )
    `
    )
    .eq('id', invoiceId)
    .single()

  if (!data?.client) return null

  const client = Array.isArray(data.client) ? data.client[0] : data.client
  // Prefer billing_email, fall back to general_email
  return client?.billing_email || client?.general_email || null
}

/**
 * Send invoice via email with PDF attachment
 */
export async function sendInvoiceWithEmail(
  invoiceId: string,
  toEmail: string,
  customMessage?: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to send invoices' }
  }

  // Get invoice with all relations
  const invoice = await getInvoice(invoiceId)
  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  // Allow draft (first send) and sent (resend) statuses
  if (invoice.status !== 'draft' && invoice.status !== 'sent') {
    return { error: 'Can only send draft or resend sent invoices' }
  }

  const isResend = invoice.status === 'sent'

  // Dynamically import react-pdf (200KB) only when actually generating a PDF
  const [{ renderToBuffer }, { InvoicePDF, DEFAULT_COMPANY_INFO }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/invoices/invoice-pdf'),
  ])

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <InvoicePDF invoice={invoice} companyInfo={DEFAULT_COMPANY_INFO} />
    )
  } catch (error) {
    console.error('Error generating PDF:', error)
    return { error: 'Failed to generate PDF' }
  }

  // Format for email
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Upon Receipt'

  // Send email (logging is handled inside sendInvoiceEmail via email_logs table)
  const emailResult = await sendInvoiceEmail({
    to: toEmail,
    invoiceNumber: invoice.invoice_number,
    invoiceId, // For logging
    clientName: invoice.client?.name ?? 'Client',
    total: formatCurrency(invoice.total),
    dueDate,
    pdfBuffer,
    customMessage,
    companyName: DEFAULT_COMPANY_INFO.name,
    companyEmail: DEFAULT_COMPANY_INFO.email,
    sentBy: user.id, // For logging
  })

  if (!emailResult.success) {
    return { error: emailResult.error ?? 'Failed to send email' }
  }

  // Update invoice status (only for first send, not resend)
  if (!isResend) {
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating invoice status:', updateError)
      // Email sent but status not updated - log and continue
    }
  }

  // Lock associated timesheets (only for first send, not resend)
  if (!isResend) {
    const { data: invoiceLines } = await supabase
      .from('invoice_lines')
      .select('timesheet_entry_id')
      .eq('invoice_id', invoiceId)
      .not('timesheet_entry_id', 'is', null)

    const entryIds = (invoiceLines ?? [])
      .filter((l) => l.timesheet_entry_id)
      .map((l) => l.timesheet_entry_id as string)

    if (entryIds.length > 0) {
      const { data: entries } = await supabase
        .from('timesheet_entries')
        .select('timesheet_id')
        .in('id', entryIds)

      const timesheetIds = [...new Set((entries ?? []).map((e) => e.timesheet_id))]

      if (timesheetIds.length > 0) {
        await supabase
          .from('timesheets')
          .update({
            status: 'locked',
            locked_at: new Date().toISOString(),
          })
          .in('id', timesheetIds)
      }
    }
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  revalidatePath('/timesheets')

  return { success: true }
}
