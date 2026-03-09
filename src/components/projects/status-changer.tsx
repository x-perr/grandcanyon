'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { projectStatuses } from '@/lib/validations/project'
import { updateProjectStatusAction } from '@/app/(protected)/projects/actions'
import type { Enums } from '@/types/database'

type ProjectStatus = Enums<'project_status'>

interface StatusChangerProps {
  projectId: string
  currentStatus: ProjectStatus
}

export function StatusChanger({ projectId, currentStatus }: StatusChangerProps) {
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('projects')

  const handleChange = (newStatus: string) => {
    if (newStatus === currentStatus) return
    startTransition(async () => {
      const result = await updateProjectStatusAction(projectId, newStatus as ProjectStatus)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('toast.status_updated'))
      }
    })
  }

  return (
    <Select value={currentStatus} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-[140px] h-7 text-xs border-dashed">
        <SelectValue>
          <StatusBadge status={currentStatus} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {projectStatuses.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            <StatusBadge status={status.value} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
