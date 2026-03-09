import { getTranslations } from 'next-intl/server'
import { getClientsForSelect, getUsersForSelect } from '../actions'
import { ProjectForm } from '@/components/projects/project-form'

export default async function NewProjectPage() {
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
