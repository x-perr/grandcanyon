import { redirect } from 'next/navigation'
import { Layers } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getRateTiers, getClientRateTiers } from './actions'
import { getCcqClassifications } from '../ccq-rates/actions'
import { RateTiersClient } from '@/components/admin/rate-tiers-client'

export default async function RateTiersPage() {
  const t = await getTranslations('admin')
  const permissions = await getUserPermissions()

  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const [tiers, clientTiers, classifications] = await Promise.all([
    getRateTiers(),
    getClientRateTiers(),
    getCcqClassifications(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-8 w-8" />
          {t('billing.rateTiers')}
        </h1>
        <p className="text-muted-foreground">
          {t('billing.rateTiersSubtitle')}
        </p>
      </div>

      <RateTiersClient
        tiers={tiers}
        clientTiers={clientTiers}
        classifications={classifications}
      />
    </div>
  )
}
