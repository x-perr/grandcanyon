import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getUser, getRoles, getUsers } from '../../actions'
import { UserForm } from '@/components/admin/user-form'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function UserEditPage({ params }: PageProps) {
  const { id } = await params
  const t = await getTranslations('admin')
  const permissions = await getUserPermissions()

  // Check admin permission
  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const [user, roles, { users: allUsers }] = await Promise.all([
    getUser(id),
    getRoles(),
    getUsers({ showInactive: true, limit: 500 }),
  ])

  if (!user) {
    notFound()
  }

  // Filter out current user from potential managers list
  const potentialManagers = allUsers.filter((u) => u.id !== id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('users.back_to_list')}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('users.edit_title', { name: `${user.first_name} ${user.last_name}` })}
        </h1>
        <p className="text-muted-foreground">
          {t('users.edit_subtitle')}
        </p>
      </div>

      <UserForm user={user} roles={roles} potentialManagers={potentialManagers} />
    </div>
  )
}
