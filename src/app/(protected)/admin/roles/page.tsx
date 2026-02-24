import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getRolesWithPermissions, getPermissionsByCategory } from '../actions'
import { RolePermissionsMatrix } from '@/components/admin/role-permissions-matrix'

export default async function RolesPage() {
  const t = await getTranslations('admin')
  const permissions = await getUserPermissions()

  // Check admin permission
  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const [roles, permissionsByCategory] = await Promise.all([
    getRolesWithPermissions(),
    getPermissionsByCategory(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          {t('roles.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('roles.subtitle')}
        </p>
      </div>

      <RolePermissionsMatrix
        roles={roles}
        permissionsByCategory={permissionsByCategory}
      />
    </div>
  )
}
