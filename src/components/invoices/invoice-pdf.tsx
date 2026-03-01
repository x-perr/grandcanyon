import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { InvoiceWithRelations } from '@/app/(protected)/invoices/actions'

// Company info - loaded from database settings
export interface CompanyInfo {
  name: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  phone?: string
  email?: string
  gstNumber?: string
  qstNumber?: string
  logoUrl?: string | null
}

// Default company info (fallback if settings not found)
export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'Systèmes Intérieurs Grand Canyon',
  address: '123 Construction Blvd',
  city: 'Montréal',
  province: 'QC',
  postalCode: 'H2X 1Y1',
  phone: '514-555-1234',
  email: 'info@grandcanyon.cc',
  gstNumber: '123456789 RT0001',
  qstNumber: '1234567890 TQ0001',
  logoUrl: null,
}

interface InvoicePDFProps {
  invoice: InvoiceWithRelations
  companyInfo?: CompanyInfo
}

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  companyInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  companyLogo: {
    width: 60,
    height: 60,
    marginRight: 12,
    objectFit: 'contain',
  },
  companyText: {
    flex: 1,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  companyDetails: {
    color: '#666666',
    fontSize: 9,
  },
  invoiceHeader: {
    textAlign: 'right',
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  invoiceDates: {
    fontSize: 9,
    color: '#666666',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    marginVertical: 20,
  },
  billToSection: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  billToLeft: {
    flex: 1,
  },
  billToRight: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  clientName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  clientDetails: {
    fontSize: 9,
    color: '#333333',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  colDescription: {
    flex: 4,
  },
  colQty: {
    flex: 1,
    textAlign: 'right',
  },
  colRate: {
    flex: 1.5,
    textAlign: 'right',
  },
  colAmount: {
    flex: 1.5,
    textAlign: 'right',
  },
  headerText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
  },
  cellText: {
    fontSize: 9,
  },
  totalsSection: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    width: 200,
    paddingVertical: 4,
  },
  totalLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 20,
    fontSize: 9,
    color: '#666666',
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
    fontSize: 9,
  },
  grandTotalRow: {
    flexDirection: 'row',
    width: 200,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    marginTop: 4,
  },
  grandTotalLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 20,
    fontSize: 11,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    width: 80,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: 'bold',
  },
  notesSection: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: '#333333',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
  },
  footerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    marginBottom: 15,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerTaxInfo: {
    fontSize: 8,
    color: '#666666',
  },
  footerThankYou: {
    fontSize: 9,
    textAlign: 'center',
    color: '#666666',
    marginTop: 15,
  },
})

// Format currency for PDF
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

// Format date for PDF
function formatDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function InvoicePDF({ invoice, companyInfo = DEFAULT_COMPANY_INFO }: InvoicePDFProps) {
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

  const showGst = invoice.client?.charges_gst !== false && (invoice.gst_amount ?? 0) > 0
  const showQst = invoice.client?.charges_qst !== false && (invoice.qst_amount ?? 0) > 0

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            {companyInfo.logoUrl && (
              <Image src={companyInfo.logoUrl} style={styles.companyLogo} />
            )}
            <View style={styles.companyText}>
              <Text style={styles.companyName}>{companyInfo.name}</Text>
              {companyInfo.address && (
                <Text style={styles.companyDetails}>{companyInfo.address}</Text>
              )}
              {(companyInfo.city || companyInfo.province || companyInfo.postalCode) && (
                <Text style={styles.companyDetails}>
                  {[companyInfo.city, companyInfo.province, companyInfo.postalCode].filter(Boolean).join(', ')}
                </Text>
              )}
              {companyInfo.phone && (
                <Text style={styles.companyDetails}>Tél: {companyInfo.phone}</Text>
              )}
              {companyInfo.email && (
                <Text style={styles.companyDetails}>{companyInfo.email}</Text>
              )}
            </View>
          </View>
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceTitle}>FACTURE / INVOICE</Text>
            <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
            <Text style={styles.invoiceDates}>
              Date: {formatDate(invoice.invoice_date)}
            </Text>
            <Text style={styles.invoiceDates}>
              Échéance / Due: {formatDate(invoice.due_date)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To Section */}
        <View style={styles.billToSection}>
          <View style={styles.billToLeft}>
            <Text style={styles.sectionTitle}>Facturer À / Bill To</Text>
            {invoice.client && (
              <>
                <Text style={styles.clientName}>{invoice.client.name}</Text>
                {invoice.client.billing_address_line1 && (
                  <Text style={styles.clientDetails}>{invoice.client.billing_address_line1}</Text>
                )}
                {(invoice.client.billing_city || invoice.client.billing_province || invoice.client.billing_postal_code) && (
                  <Text style={styles.clientDetails}>
                    {[invoice.client.billing_city, invoice.client.billing_province, invoice.client.billing_postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
              </>
            )}
          </View>
          <View style={styles.billToRight}>
            <Text style={styles.sectionTitle}>Projet / Project</Text>
            {invoice.project && (
              <>
                <Text style={styles.clientName}>{invoice.project.code}</Text>
                <Text style={styles.clientDetails}>{invoice.project.name}</Text>
              </>
            )}
            <Text style={[styles.clientDetails, { marginTop: 8 }]}>
              Période / Period:
            </Text>
            <Text style={styles.clientDetails}>
              {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
            </Text>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDescription]}>Description</Text>
            <Text style={[styles.headerText, styles.colQty]}>Qté / Qty</Text>
            <Text style={[styles.headerText, styles.colRate]}>Taux / Rate</Text>
            <Text style={[styles.headerText, styles.colAmount]}>Montant / Amount</Text>
          </View>

          {/* Table Rows */}
          {(invoice.lines ?? []).map((line, index) => (
            <View key={line.id || index} style={styles.tableRow}>
              <Text style={[styles.cellText, styles.colDescription]}>
                {getLineDescription(line)}
              </Text>
              <Text style={[styles.cellText, styles.colQty]}>
                {line.quantity.toFixed(1)}
              </Text>
              <Text style={[styles.cellText, styles.colRate]}>
                {formatCurrency(line.unit_price)}
              </Text>
              <Text style={[styles.cellText, styles.colAmount]}>
                {formatCurrency(line.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total / Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          {showGst && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TPS / GST (5%):</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.gst_amount ?? 0)}</Text>
            </View>
          )}
          {showQst && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVQ / QST (9.975%):</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.qst_amount ?? 0)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes:</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <View style={styles.footerContent}>
            <Text style={styles.footerTaxInfo}>
              TPS/GST #: {companyInfo.gstNumber}
            </Text>
            <Text style={styles.footerTaxInfo}>
              TVQ/QST #: {companyInfo.qstNumber}
            </Text>
          </View>
          <Text style={styles.footerThankYou}>
            Termes: Net 30 jours / Terms: Net 30 days{'\n'}
            Merci de votre confiance! / Thank you for your business!
          </Text>
        </View>
      </Page>
    </Document>
  )
}
