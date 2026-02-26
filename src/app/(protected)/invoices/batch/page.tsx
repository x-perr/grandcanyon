import { redirect } from 'next/navigation'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getClientsWithApprovedTimesheets } from '../actions'
import { BatchInvoiceClient } from '@/components/invoices/batch-invoice-client'
import { formatDateISO, getCurrentWeekStart, parseDateISO } from '@/lib/date'
import { getTranslations } from 'next-intl/server'

interface BatchInvoicesPageProps {
  searchParams: Promise<{
    week?: string
  }>
}

export default async function BatchInvoicesPage({ searchParams }: BatchInvoicesPageProps) {
  const params = await searchParams
  const [permissions, t] = await Promise.all([
    getUserPermissions(),
    getTranslations('invoices'),
  ])

  // Check permission
  if (!hasPermission(permissions, 'invoices.create')) {
    redirect('/invoices')
  }

  // Get week from params or use current week
  const weekStart = params.week ?? formatDateISO(getCurrentWeekStart())

  // Validate week format
  try {
    parseDateISO(weekStart)
  } catch {
    redirect(`/invoices/batch?week=${formatDateISO(getCurrentWeekStart())}`)
  }

  // Get clients with approved timesheets for this week
  const clients = await getClientsWithApprovedTimesheets(weekStart)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('batch.title')}</h1>
        <p className="text-muted-foreground">{t('batch.subtitle')}</p>
      </div>

      <BatchInvoiceClient weekStart={weekStart} clients={clients} />
    </div>
  )
}
