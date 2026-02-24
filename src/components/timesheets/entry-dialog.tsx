'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ProjectForTimesheet } from '@/app/(protected)/timesheets/actions'

interface EntryDialogProps {
  projects: ProjectForTimesheet[]
  onAdd: (entry: NewEntry) => Promise<void>
}

interface NewEntry {
  project_id: string
  task_id: string | null
  billing_role_id: string | null
  description: string | null
  is_billable: boolean
}

export function EntryDialog({ projects, onAdd }: EntryDialogProps) {
  const t = useTranslations('timesheets')
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [projectId, setProjectId] = useState<string>('')
  const [taskId, setTaskId] = useState<string>('')
  const [billingRoleId, setBillingRoleId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isBillable, setIsBillable] = useState(true)

  const selectedProject = projects.find((p) => p.id === projectId)
  const availableTasks = selectedProject?.tasks ?? []
  const availableBillingRoles = selectedProject?.billing_roles ?? []

  const resetForm = () => {
    setProjectId('')
    setTaskId('')
    setBillingRoleId('')
    setDescription('')
    setIsBillable(true)
  }

  const handleSubmit = async () => {
    if (!projectId) return

    setIsLoading(true)
    try {
      await onAdd({
        project_id: projectId,
        task_id: taskId || null,
        billing_role_id: billingRoleId || null,
        description: description || null,
        is_billable: isBillable,
      })
      setOpen(false)
      resetForm()
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('entry.add_entry')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('entry.title')}</DialogTitle>
          <DialogDescription>
            {t('entry.dialog_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Project */}
          <div className="space-y-2">
            <Label htmlFor="project">{t('entry.project_required')}</Label>
            <Select value={projectId} onValueChange={(value) => {
              setProjectId(value)
              setTaskId('')
              setBillingRoleId('')
            }}>
              <SelectTrigger id="project">
                <SelectValue placeholder={t('entry.select_project')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <span className="font-mono">{project.code}</span>
                    <span className="ml-2 text-muted-foreground">{project.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task */}
          <div className="space-y-2">
            <Label htmlFor="task">{t('entry.task_optional')}</Label>
            <Select
              value={taskId}
              onValueChange={setTaskId}
              disabled={availableTasks.length === 0}
            >
              <SelectTrigger id="task">
                <SelectValue placeholder={availableTasks.length === 0 ? t('entry.no_tasks') : t('entry.select_task')} />
              </SelectTrigger>
              <SelectContent>
                {availableTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    <span className="font-mono">{task.code}</span>
                    <span className="ml-2">{task.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Billing Role */}
          <div className="space-y-2">
            <Label htmlFor="billing-role">{t('entry.role_optional')}</Label>
            <Select
              value={billingRoleId}
              onValueChange={setBillingRoleId}
              disabled={availableBillingRoles.length === 0}
            >
              <SelectTrigger id="billing-role">
                <SelectValue placeholder={availableBillingRoles.length === 0 ? t('entry.no_roles') : t('entry.select_role')} />
              </SelectTrigger>
              <SelectContent>
                {availableBillingRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                    <span className="ml-2 text-muted-foreground">${role.rate}/hr</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('entry.description_optional')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('entry.description_placeholder')}
              rows={2}
            />
          </div>

          {/* Billable */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="billable"
              checked={isBillable}
              onCheckedChange={(checked) => setIsBillable(checked === true)}
            />
            <Label htmlFor="billable" className="text-sm">
              {t('entry.billable_to_client')}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!projectId || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('entry.adding')}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t('entry.add_entry')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
