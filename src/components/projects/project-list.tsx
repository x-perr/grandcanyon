'use client'

import { useState, useTransition, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FolderKanban, MoreHorizontal, Pencil, Trash2, Plus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useDebounceSearch, usePagination } from '@/hooks'
import type { ProjectWithClient } from '@/app/(protected)/projects/actions'
import { deleteProjectAction } from '@/app/(protected)/projects/actions'
import { projectStatuses } from '@/lib/validations/project'

interface ProjectListProps {
  projects: ProjectWithClient[]
  totalCount: number
  canEdit: boolean
  currentPage: number
  pageSize: number
  searchQuery: string
  statusFilter: string
}

export function ProjectList({
  projects,
  totalCount,
  canEdit,
  currentPage,
  pageSize,
  searchQuery,
  statusFilter,
}: ProjectListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStatusPending, startTransition] = useTransition()

  // Use custom hooks for debounced search and pagination
  const { search, setSearch, isPending: isSearchPending } = useDebounceSearch({
    initialValue: searchQuery,
    basePath: '/projects',
  })

  const {
    totalPages,
    goToPage,
    isPending: isPagePending,
    hasPrevious,
    hasNext,
    startIndex,
    endIndex,
  } = usePagination({
    totalCount,
    pageSize,
    currentPage,
    basePath: '/projects',
  })

  const isPending = isSearchPending || isPagePending || isStatusPending
  const projectToDelete = useMemo(() => projects.find((p) => p.id === deleteId), [projects, deleteId])

  const updateStatus = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('status', value)
    } else {
      params.delete('status')
    }
    params.delete('page') // Reset to first page on filter
    startTransition(() => {
      router.push(`/projects?${params.toString()}`)
    })
  }, [searchParams, router])

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const result = await deleteProjectAction(deleteId)
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

  const formatDate = useCallback((date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA')
  }, [])

  return (
    <div className="space-y-4">
      {/* Header with Search, Filter, and Add Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <SearchInput
            placeholder={t('search_placeholder')}
            value={search}
            onChange={setSearch}
            className="flex-1 sm:max-w-sm"
          />
          <Select value={statusFilter || 'all'} onValueChange={updateStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={tCommon('labels.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_statuses')}</SelectItem>
              {projectStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('new_project')}
            </Link>
          </Button>
        )}
      </div>

      {/* Table */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-300">
            <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('no_projects')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery || statusFilter
                ? t('list.adjust_filters')
                : t('no_projects_message')}
            </p>
            {canEdit && !searchQuery && !statusFilter && (
              <Button asChild className="mt-4">
                <Link href="/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('list.add_project')}
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
                <TableHead className="w-[120px]">{t('list.code')}</TableHead>
                <TableHead>{t('list.name')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('list.client')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('list.status')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('list.start')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <TableCell className="font-mono font-medium">{project.code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-muted-foreground md:hidden">
                        {project.client?.name}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {project.client?.name || '-'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {project.status && <StatusBadge status={project.status} />}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {formatDate(project.start_date)}
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
                          <Link href={`/projects/${project.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {tCommon('actions.view')}
                          </Link>
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {tCommon('actions.edit')}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(project.id)}
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
              start: startIndex,
              end: endIndex,
              total: totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={!hasPrevious || isPending}
            >
              {tCommon('actions.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={!hasNext || isPending}
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
              {t('delete.message', {
                name: projectToDelete?.name ?? '',
                code: projectToDelete?.code ?? '',
              })}
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
