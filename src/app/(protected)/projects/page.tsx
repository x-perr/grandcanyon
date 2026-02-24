import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getProjects } from './actions'
import { ProjectList } from '@/components/projects/project-list'

interface ProjectsPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    page?: string
  }>
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams
  const search = params.search || ''
  const status = params.status || ''
  const page = Number(params.page) || 1
  const pageSize = 25

  const [{ projects, count }, permissions, t] = await Promise.all([
    getProjects({
      search,
      status: status || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getUserPermissions(),
    getTranslations('projects'),
  ])

  const canEdit = hasPermission(permissions, 'projects.edit')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ProjectList
        projects={projects}
        totalCount={count}
        canEdit={canEdit}
        currentPage={page}
        pageSize={pageSize}
        searchQuery={search}
        statusFilter={status}
      />
    </div>
  )
}
