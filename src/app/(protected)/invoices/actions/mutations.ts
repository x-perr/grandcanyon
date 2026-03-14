'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { calculateTaxes } from '@/lib/tax'
import { createInvoiceSchema, isValidInvoiceTransition, type CreateInvoiceData, type InvoiceLineFormData } from '@/lib/validations/invoice'
import type { RateSource } from '@/types/billing'

/**
 * Create a new invoice with line items
 */
export async function createInvoice(data: CreateInvoiceData) {
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
    return { error: 'You do not have permission to create invoices' }
  }

  // Validate
  const validation = createInvoiceSchema.safeParse(data)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // Get client tax settings
  const { data: client } = await supabase
    .from('clients')
    .select('charges_gst, charges_qst')
    .eq('id', data.client_id)
    .single()

  if (!client) {
    return { error: 'Client not found' }
  }

  // Calculate totals
  const subtotal = data.lines.reduce((sum, line) => sum + line.amount, 0)
  const taxes = calculateTaxes(subtotal, client.charges_gst ?? true, client.charges_qst ?? true)

  // Atomically get next invoice number (prevents race conditions)
  const { data: nextNum, error: rpcError } = await supabase.rpc('get_next_invoice_number')
  if (rpcError || !nextNum) {
    return { error: 'Failed to generate invoice number' }
  }

  const year = new Date().getFullYear()
  const invoiceNumber = `${year}-${String(nextNum).padStart(3, '0')}`

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      client_id: data.client_id,
      project_id: data.project_id,
      status: 'draft',
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      period_start: data.period_start,
      period_end: data.period_end,
      subtotal: taxes.subtotal,
      gst_amount: taxes.gst,
      qst_amount: taxes.qst,
      total: taxes.total,
      notes: data.notes,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError)
    return { error: 'Failed to create invoice' }
  }

  // Create line items, capturing rate source metadata for audit trail
  const lineItems = data.lines.map((line, index) => {
    const item: Record<string, unknown> = {
      invoice_id: invoice.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      amount: line.amount,
      timesheet_entry_id: line.timesheet_entry_id || null,
      expense_entry_id: line.expense_entry_id || null,
      sort_order: index + 1,
    }

    // Capture billing rate source for audit trail (from rate resolution cascade)
    const lineWithMeta = line as InvoiceLineFormData & {
      rate_source?: RateSource
      rate_tier_code?: string | null
      rate_classification_level?: string | null
    }
    if (lineWithMeta.rate_source) {
      item.rate_source = lineWithMeta.rate_source
      // Store additional rate context in metadata if present
      const rateMeta: Record<string, string> = {}
      if (lineWithMeta.rate_tier_code) rateMeta.tier_code = lineWithMeta.rate_tier_code
      if (lineWithMeta.rate_classification_level) rateMeta.classification_level = lineWithMeta.rate_classification_level
      if (Object.keys(rateMeta).length > 0) {
        item.rate_metadata = rateMeta
      }
    }

    return item
  })

  const { error: linesError } = await supabase.from('invoice_lines').insert(lineItems)

  if (linesError) {
    console.error('Error creating invoice lines:', linesError)
    // Rollback invoice
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { error: 'Failed to create invoice lines' }
  }

  // Note: Timesheet entries are linked via invoice_lines.timesheet_entry_id
  // No need to update timesheet_entries - the relationship is already established

  revalidatePath('/invoices')

  // Return invoice ID for client-side navigation
  return { invoiceId: invoice.id }
}

/**
 * Update a draft invoice
 */
export async function updateInvoice(
  invoiceId: string,
  data: {
    invoice_date?: string
    due_date?: string
    period_start?: string
    period_end?: string
    notes?: string | null
    lines?: InvoiceLineFormData[]
  }
) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to edit invoices' }
  }

  // Get invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status, client_id')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (invoice.status !== 'draft') {
    return { error: 'Can only edit draft invoices' }
  }

  // Get client tax settings for recalculation
  const { data: client } = await supabase
    .from('clients')
    .select('charges_gst, charges_qst')
    .eq('id', invoice.client_id)
    .single()

  // Update lines if provided
  if (data.lines && data.lines.length > 0) {
    // Delete existing lines
    await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId)

    // Insert new lines, capturing rate source metadata for audit trail
    const lineItems = data.lines.map((line, index) => {
      const item: Record<string, unknown> = {
        invoice_id: invoiceId,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
        timesheet_entry_id: line.timesheet_entry_id || null,
        expense_entry_id: line.expense_entry_id || null,
        sort_order: index + 1,
      }

      // Capture billing rate source for audit trail
      const lineWithMeta = line as InvoiceLineFormData & {
        rate_source?: RateSource
        rate_tier_code?: string | null
        rate_classification_level?: string | null
      }
      if (lineWithMeta.rate_source) {
        item.rate_source = lineWithMeta.rate_source
        const rateMeta: Record<string, string> = {}
        if (lineWithMeta.rate_tier_code) rateMeta.tier_code = lineWithMeta.rate_tier_code
        if (lineWithMeta.rate_classification_level) rateMeta.classification_level = lineWithMeta.rate_classification_level
        if (Object.keys(rateMeta).length > 0) {
          item.rate_metadata = rateMeta
        }
      }

      return item
    })

    await supabase.from('invoice_lines').insert(lineItems)

    // Recalculate totals
    const subtotal = data.lines.reduce((sum, line) => sum + line.amount, 0)
    const taxes = calculateTaxes(subtotal, client?.charges_gst ?? true, client?.charges_qst ?? true)

    const { error } = await supabase
      .from('invoices')
      .update({
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        period_start: data.period_start,
        period_end: data.period_end,
        notes: data.notes,
        subtotal: taxes.subtotal,
        gst_amount: taxes.gst,
        qst_amount: taxes.qst,
        total: taxes.total,
      })
      .eq('id', invoiceId)

    if (error) {
      console.error('Error updating invoice:', error)
      return { error: 'Failed to update invoice' }
    }
  } else {
    // Just update dates/notes
    const { error } = await supabase
      .from('invoices')
      .update({
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        period_start: data.period_start,
        period_end: data.period_end,
        notes: data.notes,
      })
      .eq('id', invoiceId)

    if (error) {
      console.error('Error updating invoice:', error)
      return { error: 'Failed to update invoice' }
    }
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  return { success: true }
}

/**
 * Send an invoice (mark as sent, lock timesheets)
 */
export async function sendInvoice(invoiceId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to send invoices' }
  }

  // Get invoice with lines
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status, lines:invoice_lines(timesheet_entry_id)')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (!isValidInvoiceTransition(invoice.status ?? '', 'sent')) {
    return { error: 'Can only send draft invoices' }
  }

  // Update status
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Error sending invoice:', error)
    return { error: 'Failed to send invoice' }
  }

  // Lock associated timesheets
  const entryIds = (invoice.lines ?? [])
    .filter((l) => l.timesheet_entry_id)
    .map((l) => l.timesheet_entry_id as string)

  if (entryIds.length > 0) {
    // Get unique timesheet IDs
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

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Mark invoice as paid
 */
export async function markInvoicePaid(invoiceId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to update invoices' }
  }

  // Get invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (!isValidInvoiceTransition(invoice.status ?? '', 'paid')) {
    return { error: 'Can only mark sent invoices as paid' }
  }

  // Update status
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Error marking invoice as paid:', error)
    return { error: 'Failed to mark invoice as paid' }
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  return { success: true }
}

/**
 * Cancel an invoice (void it, unlock timesheets)
 */
export async function cancelInvoice(invoiceId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to cancel invoices' }
  }

  // Get invoice with lines
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status, lines:invoice_lines(id, timesheet_entry_id)')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (!isValidInvoiceTransition(invoice.status ?? '', 'void')) {
    return { error: 'Cannot cancel paid invoices' }
  }

  // Unlink timesheet entries by deleting invoice lines
  const entryIds = (invoice.lines ?? [])
    .filter((l) => l.timesheet_entry_id)
    .map((l) => l.timesheet_entry_id as string)

  // Delete invoice lines to free up entries for re-invoicing
  const lineIds = (invoice.lines ?? []).map((l) => l.id)
  if (lineIds.length > 0) {
    await supabase.from('invoice_lines').delete().in('id', lineIds)
  }

  if (entryIds.length > 0) {
    // Unlock timesheets (set back to approved)
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id')
      .in('id', entryIds)

    const timesheetIds = [...new Set((entries ?? []).map((e) => e.timesheet_id))]

    if (timesheetIds.length > 0) {
      await supabase
        .from('timesheets')
        .update({
          status: 'approved',
          locked_at: null,
        })
        .in('id', timesheetIds)
    }
  }

  // Void the invoice (soft delete)
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'void',
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Error cancelling invoice:', error)
    return { error: 'Failed to cancel invoice' }
  }

  revalidatePath('/invoices')
  revalidatePath('/timesheets')
  redirect('/invoices')
}

/**
 * Delete a draft invoice
 */
export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to delete invoices' }
  }

  // Get invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (invoice.status !== 'draft') {
    return { error: 'Can only delete draft invoices' }
  }

  // Delete lines first
  await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId)

  // Delete invoice
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId)

  if (error) {
    console.error('Error deleting invoice:', error)
    return { error: 'Failed to delete invoice' }
  }

  revalidatePath('/invoices')
  redirect('/invoices')
}
