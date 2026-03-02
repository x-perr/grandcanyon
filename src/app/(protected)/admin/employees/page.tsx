import { redirect } from 'next/navigation'
import { HardHat } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getEmployees } from '../actions'
import { EmployeeList } from '@/components/admin/employee-list'

interface PageProps {
  searchParams: Promise<{
    search?: string
    page?: string
    inactive?: string
  }>
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const t = await getTranslations('admin')
  const permissions = await getUserPermissions()

  // Check admin permission
  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const page = parseInt(params.page ?? '1', 10)
  const pageSize = 25
  const showInactive = params.inactive === 'true'

  const { employees, count } = await getEmployees({
    search: params.search,
    showInactive,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <HardHat className="h-8 w-8" />
          {t('employees.title')}
        </h1>
        <p className="text-muted-foreground">{t('employees.subtitle')}</p>
      </div>

      <EmployeeList
        employees={employees}
        totalCount={count}
        currentPage={page}
        pageSize={pageSize}
        searchQuery={params.search ?? ''}
        showInactive={showInactive}
      />
    </div>
  )
}
