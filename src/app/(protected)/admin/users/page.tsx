import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getUsers, getRoles, getInvitations } from '../actions'
import { UserList } from '@/components/admin/user-list'
import { InvitationList } from '@/components/admin/invitation-list'
import { InviteUserDialog } from '@/components/admin/invite-user-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PageProps {
  searchParams: Promise<{
    search?: string
    page?: string
    role?: string
    inactive?: string
    tab?: string
    invPage?: string
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
  const invPage = parseInt(params.invPage ?? '1', 10)
  const pageSize = 25
  const showInactive = params.inactive === 'true'
  const activeTab = params.tab ?? 'users'

  const [{ users, count }, roles, { invitations, count: invCount }] = await Promise.all([
    getUsers({
      search: params.search,
      showInactive,
      roleId: params.role,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getRoles(),
    getInvitations({
      limit: pageSize,
      offset: (invPage - 1) * pageSize,
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            {t('users.title')}
          </h1>
          <p className="text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <InviteUserDialog roles={roles} />
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            {t('users.tab_users')} ({count})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            {t('users.tab_invitations')} ({invCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
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
        </TabsContent>

        <TabsContent value="invitations">
          <InvitationList
            invitations={invitations}
            totalCount={invCount}
            currentPage={invPage}
            pageSize={pageSize}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
