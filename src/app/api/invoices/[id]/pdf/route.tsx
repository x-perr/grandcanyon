import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoicePDF, DEFAULT_COMPANY_INFO, type CompanyInfo } from '@/components/invoices/invoice-pdf'
import type { InvoiceWithRelations } from '@/app/(protected)/invoices/actions'

/**
 * Get company settings from database
 */
async function getCompanySettings(): Promise<CompanyInfo> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'company_info')
    .single()

  if (error || !data) {
    return DEFAULT_COMPANY_INFO
  }

  // Merge with defaults to ensure all fields exist
  return { ...DEFAULT_COMPANY_INFO, ...(data.value as Partial<CompanyInfo>) }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Fetch invoice and company settings in parallel
    const [invoiceResult, companyInfo] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          `
        *,
        client:clients!invoices_client_id_fkey(
          id, code, name, short_name,
          billing_address_line1, billing_city, billing_province, billing_postal_code,
          charges_gst, charges_qst
        ),
        project:projects!invoices_project_id_fkey(id, code, name),
        lines:invoice_lines(
          *,
          timesheet_entry:timesheet_entries(
            id,
            hours,
            timesheet:timesheets(
              user:profiles!timesheets_user_id_fkey(first_name, last_name)
            )
          )
        )
      `
        )
        .eq('id', id)
        .single(),
      getCompanySettings(),
    ])

    if (invoiceResult.error) {
      console.error('Error fetching invoice:', invoiceResult.error)
      return new NextResponse('Invoice not found', { status: 404 })
    }

    const invoiceData = invoiceResult.data

    // Transform the data to match InvoiceWithRelations type
    const invoice: InvoiceWithRelations = {
      ...invoiceData,
      client: Array.isArray(invoiceData.client)
        ? invoiceData.client[0] ?? null
        : invoiceData.client,
      project: Array.isArray(invoiceData.project)
        ? invoiceData.project[0] ?? null
        : invoiceData.project,
      lines: invoiceData.lines ?? [],
    }

    // Generate PDF with dynamic company settings
    const pdfBuffer = await renderToBuffer(
      <InvoicePDF invoice={invoice} companyInfo={companyInfo} />
    )

    // Return PDF response
    const filename = `INV-${invoice.invoice_number}.pdf`

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const pdfBytes = new Uint8Array(pdfBuffer)

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return new NextResponse('Failed to generate PDF', { status: 500 })
  }
}
