import { StyleSheet } from '@react-pdf/renderer'

export const styles = StyleSheet.create({
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
