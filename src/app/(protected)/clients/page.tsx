import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { getClients } from './actions'
import type { SortColumn, SortDirection } from './actions'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { ClientList } from '@/components/clients/client-list'
import { Skeleton } from '@/components/ui/skeleton'

const DEFAULT_PAGE_SIZE = 20
const VALID_SORT_COLUMNS: SortColumn[] = ['code', 'name', 'general_email', 'created_at']

interface ClientsPageProps {
  searchParams: Promise<{
    search?: string
    page?: string
    pageSize?: string
    sort?: string
    order?: string
    inactive?: string
  }>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams
  const search = params.search ?? ''
  const page = parseInt(params.page ?? '1', 10)
  const pageSize = parseInt(params.pageSize ?? String(DEFAULT_PAGE_SIZE), 10)
  const sortColumn = VALID_SORT_COLUMNS.includes(params.sort as SortColumn)
    ? (params.sort as SortColumn)
    : 'name'
  const sortDirection: SortDirection = params.order === 'desc' ? 'desc' : 'asc'
  const showInactive = params.inactive === 'true'

  const [{ clients, count }, permissions] = await Promise.all([
    getClients({
      search,
      showInactive,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortColumn,
      sortDirection,
    }),
    getUserPermissions(),
  ])

  const canEdit = hasPermission(permissions, 'clients.edit')
  const t = await getTranslations('clients')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Suspense fallback={<ClientListSkeleton />}>
        <ClientList
          clients={clients}
          totalCount={count}
          canEdit={canEdit}
          currentPage={page}
          pageSize={pageSize}
          searchQuery={search}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          showInactive={showInactive}
        />
      </Suspense>
    </div>
  )
}

function ClientListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-10 w-[120px]" />
      </div>
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
