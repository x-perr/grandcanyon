'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Building2, MoreHorizontal, Pencil, Trash2, Plus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { SortableHeader } from '@/components/ui/sortable-header'
import { PaginationBar } from '@/components/ui/pagination-bar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { useDebounceSearch, usePagination, useSort } from '@/hooks'
import type { ClientWithProjects, SortDirection } from '@/app/(protected)/clients/actions'
import { deleteClientAction } from '@/app/(protected)/clients/actions'

interface ClientListProps {
  clients: ClientWithProjects[]
  totalCount: number
  canEdit: boolean
  currentPage: number
  pageSize: number
  searchQuery: string
  sortColumn: string
  sortDirection: SortDirection
}

export function ClientList({
  clients,
  totalCount,
  canEdit,
  currentPage,
  pageSize,
  searchQuery,
  sortColumn,
  sortDirection,
}: ClientListProps) {
  const router = useRouter()
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use custom hooks for debounced search and pagination
  const { search, setSearch, isPending: isSearchPending } = useDebounceSearch({
    initialValue: searchQuery,
    basePath: '/clients',
  })

  const {
    totalPages,
    goToPage,
    setPageSize,
    isPending: isPagePending,
  } = usePagination({
    totalCount,
    pageSize,
    currentPage,
    basePath: '/clients',
  })

  const {
    handleSort,
    isSorted,
    getSortDirection,
    isPending: isSortPending,
  } = useSort({
    basePath: '/clients',
    defaultColumn: sortColumn,
    defaultDirection: sortDirection,
  })

  const isPending = isSearchPending || isPagePending || isSortPending
  const clientToDelete = useMemo(() => clients.find((c) => c.id === deleteId), [clients, deleteId])

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const result = await deleteClientAction(deleteId)
      if (result?.error) {
        toast.error(result.error)
        setIsDeleting(false)
        return
      }
      toast.success(t('toast.deleted'))
      setDeleteId(null)
    } catch {
      toast.error(t('toast.error_delete'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with Search and Add Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder={t('search_placeholder')}
          value={search}
          onChange={setSearch}
          className="w-full sm:max-w-sm"
        />
        {canEdit && (
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('new_client')}
            </Link>
          </Button>
        )}
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-300">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('no_clients')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery
                ? t('list.search_empty')
                : t('no_clients_message')}
            </p>
            {canEdit && !searchQuery && (
              <Button asChild className="mt-4">
                <Link href="/clients/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {tCommon('actions.add')}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader
                  column="code"
                  label={tCommon('labels.code')}
                  isSorted={isSorted('code')}
                  direction={getSortDirection('code')}
                  onClick={() => handleSort('code')}
                  className="w-[100px]"
                />
                <SortableHeader
                  column="name"
                  label={tCommon('labels.name')}
                  isSorted={isSorted('name')}
                  direction={getSortDirection('name')}
                  onClick={() => handleSort('name')}
                />
                <SortableHeader
                  column="general_email"
                  label={tCommon('labels.email')}
                  isSorted={isSorted('general_email')}
                  direction={getSortDirection('general_email')}
                  onClick={() => handleSort('general_email')}
                  className="hidden md:table-cell"
                />
                <TableHead className="hidden sm:table-cell">{t('tabs.projects')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <TableCell className="font-mono font-medium">{client.code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{client.name}</div>
                      {client.short_name !== client.name && (
                        <div className="text-sm text-muted-foreground">{client.short_name}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {client.general_email || '-'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {client.projects?.[0]?.count ?? 0}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{tCommon('labels.actions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {tCommon('actions.view')}
                          </Link>
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${client.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {tCommon('actions.edit')}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(client.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tCommon('actions.delete')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          pageSizeOptions={[20, 50, 100]}
          onPageChange={goToPage}
          onPageSizeChange={setPageSize}
          isPending={isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete.title')}</DialogTitle>
            <DialogDescription>
              {t('delete.message', { name: clientToDelete?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
              {tCommon('actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? tCommon('actions.deleting') : tCommon('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
