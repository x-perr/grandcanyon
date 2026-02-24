import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getCompanySettings } from './actions'
import { CompanySettingsForm } from '@/components/admin/company-settings-form'

export default async function AdminPage() {
  const permissions = await getUserPermissions()

  // Check admin permission
  if (!hasPermission(permissions, 'admin.manage')) {
    redirect('/dashboard')
  }

  const settings = await getCompanySettings()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Admin Settings
        </h1>
        <p className="text-muted-foreground">
          Manage company information and system settings
        </p>
      </div>

      <CompanySettingsForm settings={settings} />
    </div>
  )
}
