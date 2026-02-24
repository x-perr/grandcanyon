'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ListTodo, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { TaskDialog } from './task-dialog'
import { deleteTaskAction } from '@/app/(protected)/projects/[id]/tasks/actions'

interface Task {
  id: string
  code: string
  name: string
  description: string | null
  sort_order: number | null
  start_date: string | null
  end_date: string | null
}

interface TaskListProps {
  projectId: string
  tasks: Task[]
  canEdit: boolean
}

export function TaskList({ projectId, tasks, canEdit }: TaskListProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const taskToDelete = tasks.find((t) => t.id === deleteId)

  // Sort tasks by sort_order
  const sortedTasks = [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingTask(null)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const result = await deleteTaskAction(projectId, deleteId)
      if (result?.error) {
        console.error(result.error)
      }
    } catch {
      console.error('Failed to delete task')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('tasks.title')} ({tasks.length})</h3>
        {canEdit && (
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t('tasks.add_task')}
          </Button>
        )}
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ListTodo className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">{t('tasks.no_tasks')}</p>
            {canEdit && (
              <Button size="sm" variant="outline" className="mt-4" onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                {t('tasks.add_first')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                    <span className="text-xs font-mono font-medium">{task.code}</span>
                  </div>
                  <div>
                    <div className="font-medium">{task.name}</div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{tCommon('labels.actions')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(task)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {tCommon('actions.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(task.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {tCommon('actions.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Task Dialog */}
      <TaskDialog
        projectId={projectId}
        task={editingTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tasks.delete_title')}</DialogTitle>
            <DialogDescription>
              {t('tasks.delete_message', { code: taskToDelete?.code ?? '', name: taskToDelete?.name ?? '' })}
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
