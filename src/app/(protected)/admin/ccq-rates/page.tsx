import { redirect } from 'next/navigation'
import { DollarSign } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getCcqTrades, getCcqClassifications, getCcqRates } from './actions'
import { CcqRatesClient } from '@/components/admin/ccq-rates-client'

export default async function CcqRatesPage() {
  const t = await getTranslations('admin')
  const permissions = await getUserPermissions()

  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const [trades, classifications, rates] = await Promise.all([
    getCcqTrades(),
    getCcqClassifications(),
    getCcqRates(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          {t('billing.ccqRates')}
        </h1>
        <p className="text-muted-foreground">
          {t('billing.ccqRatesSubtitle')}
        </p>
      </div>

      <CcqRatesClient
        trades={trades}
        classifications={classifications}
        rates={rates}
      />
    </div>
  )
}
