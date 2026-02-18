import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoicePDF, DEFAULT_COMPANY_INFO } from '@/components/invoices/invoice-pdf'
import type { InvoiceWithRelations } from '@/app/(protected)/invoices/actions'

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

    // Fetch invoice with all related data
    const { data: invoiceData, error } = await supabase
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
              user:profiles(first_name, last_name)
            )
          )
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching invoice:', error)
      return new NextResponse('Invoice not found', { status: 404 })
    }

    // Transform the data to match InvoiceWithRelations type
    const invoice: InvoiceWithRelations = {
      ...invoiceData,
      client: Array.isArray(invoiceData.client)
        ? invoiceData.client[0]
          ? {
              ...invoiceData.client[0],
              address: invoiceData.client[0].billing_address_line1,
              city: invoiceData.client[0].billing_city,
              province: invoiceData.client[0].billing_province,
              postal_code: invoiceData.client[0].billing_postal_code,
            }
          : null
        : invoiceData.client
          ? {
              ...invoiceData.client,
              address: invoiceData.client.billing_address_line1,
              city: invoiceData.client.billing_city,
              province: invoiceData.client.billing_province,
              postal_code: invoiceData.client.billing_postal_code,
            }
          : null,
      project: Array.isArray(invoiceData.project)
        ? invoiceData.project[0] ?? null
        : invoiceData.project,
      lines: invoiceData.lines ?? [],
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      <InvoicePDF invoice={invoice} companyInfo={DEFAULT_COMPANY_INFO} />
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
