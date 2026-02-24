'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  createTaskAction,
  updateTaskAction,
} from '@/app/(protected)/projects/[id]/tasks/actions'

interface Task {
  id: string
  code: string
  name: string
  description: string | null
  sort_order: number | null
  start_date: string | null
  end_date: string | null
}

interface TaskDialogProps {
  projectId: string
  task?: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDialog({ projectId, task, open, onOpenChange }: TaskDialogProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!task

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)

    try {
      const result = isEdit
        ? await updateTaskAction(projectId, task.id, formData)
        : await createTaskAction(projectId, formData)

      if (result?.error) {
        setError(result.error)
      } else {
        onOpenChange(false)
      }
    } catch {
      setError(tCommon('errors.unexpected'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? t('tasks.edit_task') : t('tasks.add_task')}</DialogTitle>
            <DialogDescription>
              {isEdit ? t('tasks.edit_dialog_desc') : t('tasks.add_dialog_desc')}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('tasks.task_name')} *</Label>
              <Input
                id="name"
                name="name"
                placeholder={t('tasks.task_name_placeholder')}
                defaultValue={task?.name ?? ''}
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{tCommon('labels.description')}</Label>
              <Textarea
                id="description"
                name="description"
                placeholder={t('tasks.description_placeholder')}
                defaultValue={task?.description ?? ''}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? tCommon('actions.save_changes') : t('tasks.add_task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
