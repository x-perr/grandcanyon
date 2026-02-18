import { Suspense } from 'react'
import { getClients } from './actions'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { ClientList } from '@/components/clients/client-list'
import { Skeleton } from '@/components/ui/skeleton'

interface ClientsPageProps {
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams
  const search = params.search ?? ''
  const page = parseInt(params.page ?? '1', 10)
  const pageSize = 25

  const [{ clients, count }, permissions] = await Promise.all([
    getClients({
      search,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getUserPermissions(),
  ])

  const canEdit = hasPermission(permissions, 'clients.edit')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">Manage your client companies and contacts</p>
      </div>

      <Suspense fallback={<ClientListSkeleton />}>
        <ClientList
          clients={clients}
          totalCount={count}
          canEdit={canEdit}
          currentPage={page}
          pageSize={pageSize}
          searchQuery={search}
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
