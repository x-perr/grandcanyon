'use client'

import { useState, useTransition, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Building2, MoreHorizontal, Pencil, Trash2, Plus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
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
import type { ClientWithProjects } from '@/app/(protected)/clients/actions'
import { deleteClientAction } from '@/app/(protected)/clients/actions'

interface ClientListProps {
  clients: ClientWithProjects[]
  totalCount: number
  canEdit: boolean
  currentPage: number
  pageSize: number
  searchQuery: string
}

export function ClientList({
  clients,
  totalCount,
  canEdit,
  currentPage,
  pageSize,
  searchQuery,
}: ClientListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize derived calculations
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])
  const clientToDelete = useMemo(() => clients.find((c) => c.id === deleteId), [clients, deleteId])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const updateSearch = useCallback((value: string) => {
    setSearch(value)

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value)
      } else {
        params.delete('search')
      }
      params.delete('page') // Reset to first page on search
      startTransition(() => {
        router.push(`/clients?${params.toString()}`)
      })
    }, 300)
  }, [searchParams, router])

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/clients?${params.toString()}`)
    })
  }

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
          onChange={updateSearch}
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
                <TableHead className="w-[100px]">{tCommon('labels.code')}</TableHead>
                <TableHead>{tCommon('labels.name')}</TableHead>
                <TableHead className="hidden md:table-cell">{tCommon('labels.email')}</TableHead>
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {tCommon('pagination.showing', {
              start: (currentPage - 1) * pageSize + 1,
              end: Math.min(currentPage * pageSize, totalCount),
              total: totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              {tCommon('actions.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              {tCommon('actions.next')}
            </Button>
          </div>
        </div>
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
