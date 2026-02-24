import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getUsers, getRoles } from '../actions'
import { UserList } from '@/components/admin/user-list'

interface PageProps {
  searchParams: Promise<{
    search?: string
    page?: string
    role?: string
    inactive?: string
  }>
}

export default async function UsersPage({ searchParams }: PageProps) {
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

  const [{ users, count }, roles] = await Promise.all([
    getUsers({
      search: params.search,
      showInactive,
      roleId: params.role,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getRoles(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8" />
          {t('users.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('users.subtitle')}
        </p>
      </div>

      <UserList
        users={users}
        roles={roles}
        totalCount={count}
        currentPage={page}
        pageSize={pageSize}
        searchQuery={params.search ?? ''}
        selectedRole={params.role}
        showInactive={showInactive}
      />
    </div>
  )
}
