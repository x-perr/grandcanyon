import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getProjects } from './actions'
import type { SortColumn, SortDirection } from './actions'
import { ProjectList } from '@/components/projects/project-list'

const VALID_SORT_COLUMNS: SortColumn[] = ['code', 'name', 'status', 'start_date', 'created_at', 'client_name']

interface ProjectsPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    page?: string
    inactive?: string
    sort?: string
    order?: string
  }>
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams
  const search = params.search || ''
  const status = params.status || ''
  const page = Number(params.page) || 1
  const pageSize = 25
  const showInactive = params.inactive === 'true'
  const sortColumn = VALID_SORT_COLUMNS.includes(params.sort as SortColumn)
    ? (params.sort as SortColumn)
    : 'created_at'
  const sortDirection: SortDirection = params.order === 'asc' ? 'asc' : 'desc'

  const [{ projects, count }, permissions, t] = await Promise.all([
    getProjects({
      search,
      showInactive,
      status: status || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortColumn,
      sortDirection,
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
        showInactive={showInactive}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
      />
    </div>
  )
}
