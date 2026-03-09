'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FolderKanban, MoreHorizontal, Pencil, Trash2, Plus, ExternalLink, Power } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { SortableHeader } from '@/components/ui/sortable-header'
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
import { usePagination, useSort } from '@/hooks'
import type { ProjectWithClient, SortDirection } from '@/app/(protected)/projects/actions'
import { deleteProjectAction, toggleProjectActive } from '@/app/(protected)/projects/actions'
import { ProjectListFilters } from './project-list-filters'

interface ProjectListProps {
  projects: ProjectWithClient[]
  totalCount: number
  canEdit: boolean
  currentPage: number
  pageSize: number
  searchQuery: string
  statusFilter: string
  showInactive: boolean
  sortColumn: string
  sortDirection: SortDirection
}

export function ProjectList({
  projects,
  totalCount,
  canEdit,
  currentPage,
  pageSize,
  searchQuery,
  statusFilter,
  showInactive,
  sortColumn,
  sortDirection,
}: ProjectListProps) {
  const router = useRouter()
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toggleId, setToggleId] = useState<string | null>(null)
  const [isToggling, setIsToggling] = useState(false)
  const [isFilterPending, setIsFilterPending] = useState(false)

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

  const {
    handleSort,
    isSorted,
    getSortDirection,
    isPending: isSortPending,
  } = useSort({
    basePath: '/projects',
    defaultColumn: sortColumn,
    defaultDirection: sortDirection,
  })

  const isPending = isPagePending || isFilterPending || isSortPending
  const projectToDelete = useMemo(() => projects.find((p) => p.id === deleteId), [projects, deleteId])
  const projectToToggle = useMemo(() => projects.find((p) => p.id === toggleId), [projects, toggleId])

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

  const handleToggleActive = async () => {
    if (!toggleId) return
    setIsToggling(true)
    try {
      const result = await toggleProjectActive(toggleId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          result.is_active
            ? t('toast.activated')
            : t('toast.deactivated')
        )
      }
      setToggleId(null)
    } catch {
      toast.error(t('toast.error_toggle'))
    } finally {
      setIsToggling(false)
    }
  }

  const formatDate = useCallback((date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA')
  }, [])

  return (
    <div className="space-y-4">
      {/* Header with Search, Filter, and Add Button */}
      <ProjectListFilters
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        showInactive={showInactive}
        canEdit={canEdit}
        t={t}
        tCommon={tCommon}
        onPendingChange={setIsFilterPending}
      />

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
                <SortableHeader
                  column="code"
                  label={t('list.code')}
                  isSorted={isSorted('code')}
                  direction={getSortDirection('code')}
                  onClick={() => handleSort('code')}
                  className="w-[120px]"
                />
                <SortableHeader
                  column="name"
                  label={t('list.name')}
                  isSorted={isSorted('name')}
                  direction={getSortDirection('name')}
                  onClick={() => handleSort('name')}
                />
                <SortableHeader
                  column="client_name"
                  label={t('list.client')}
                  isSorted={isSorted('client_name')}
                  direction={getSortDirection('client_name')}
                  onClick={() => handleSort('client_name')}
                  className="hidden md:table-cell"
                />
                <SortableHeader
                  column="status"
                  label={t('list.status')}
                  isSorted={isSorted('status')}
                  direction={getSortDirection('status')}
                  onClick={() => handleSort('status')}
                  className="hidden sm:table-cell"
                />
                <SortableHeader
                  column="start_date"
                  label={t('list.start')}
                  isSorted={isSorted('start_date')}
                  direction={getSortDirection('start_date')}
                  onClick={() => handleSort('start_date')}
                  className="hidden lg:table-cell"
                />
                <TableHead className="w-[80px]"></TableHead>
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
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                        <Link href={`/projects/${project.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{tCommon('actions.edit')}</span>
                        </Link>
                      </Button>
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
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}/edit`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {tCommon('actions.edit')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setToggleId(project.id)}>
                            <Power className="mr-2 h-4 w-4" />
                            {project.is_active ? t('deactivate') : t('activate')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(project.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {tCommon('actions.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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

      {/* Toggle Active Confirmation Dialog */}
      <Dialog open={!!toggleId} onOpenChange={() => setToggleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {projectToToggle?.is_active ? t('toggle.deactivate_title') : t('toggle.activate_title')}
            </DialogTitle>
            <DialogDescription>
              {projectToToggle?.is_active
                ? t('toggle.deactivate_message', {
                    name: projectToToggle?.name ?? '',
                    code: projectToToggle?.code ?? '',
                  })
                : t('toggle.activate_message', {
                    name: projectToToggle?.name ?? '',
                    code: projectToToggle?.code ?? '',
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleId(null)} disabled={isToggling}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant={projectToToggle?.is_active ? 'destructive' : 'default'}
              onClick={handleToggleActive}
              disabled={isToggling}
            >
              {isToggling
                ? tCommon('actions.loading')
                : projectToToggle?.is_active
                  ? t('deactivate')
                  : t('activate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
