import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getPendingOtApprovals } from '../actions'
import { OtApprovalQueue } from '@/components/timesheets/ot-approval-queue'

export default async function OtApprovalsPage() {
  const t = await getTranslations('timesheets')
  const permissions = await getUserPermissions()

  // Permission check: requires timesheets.approve or admin.manage
  if (!hasPermission(permissions, 'timesheets.approve') && !hasPermission(permissions, 'admin.manage')) {
    redirect('/timesheets')
  }

  const entries = await getPendingOtApprovals()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/timesheets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('back')}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ot.approvals.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('ot.approvals.subtitle')}</p>
        </div>
      </div>

      {/* OT Approval Queue */}
      <OtApprovalQueue entries={entries} />
    </div>
  )
}
