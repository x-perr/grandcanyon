import { redirect } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getAuditLogs, getAuditLogUsers } from '../actions'
import { AuditLogList } from '@/components/admin/audit-log-list'

interface PageProps {
  searchParams: Promise<{
    page?: string
    action?: string
    entity?: string
    user?: string
    from?: string
    to?: string
    search?: string
  }>
}

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const t = await getTranslations('admin')
  const permissions = await getUserPermissions()

  // Check admin permission
  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const pageSize = 25

  // Fetch logs and users for filter dropdown
  const [{ logs, count }, users] = await Promise.all([
    getAuditLogs({
      action: params.action,
      entityType: params.entity,
      userId: params.user,
      dateFrom: params.from,
      dateTo: params.to,
      search: params.search,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getAuditLogUsers(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-8 w-8" />
          {t('logs.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('logs.subtitle')}
        </p>
      </div>

      <AuditLogList
        logs={logs}
        users={users}
        totalCount={count}
        currentPage={page}
        pageSize={pageSize}
        searchQuery={params.search ?? ''}
        selectedAction={params.action}
        selectedEntity={params.entity}
        selectedUser={params.user}
        dateFrom={params.from}
        dateTo={params.to}
      />
    </div>
  )
}
