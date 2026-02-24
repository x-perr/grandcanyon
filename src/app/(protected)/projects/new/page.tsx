import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getClientsForSelect, getUsersForSelect } from '../actions'
import { ProjectForm } from '@/components/projects/project-form'

export default async function NewProjectPage() {
  const permissions = await getUserPermissions()

  if (!hasPermission(permissions, 'projects.edit')) {
    redirect('/projects')
  }

  const [clients, users, t] = await Promise.all([
    getClientsForSelect(),
    getUsersForSelect(),
    getTranslations('projects'),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('new_project')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ProjectForm mode="create" clients={clients} users={users} />
    </div>
  )
}
