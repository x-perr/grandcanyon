'use client'

import { useState, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { HourInput } from './hour-input'
import { sumHours } from '@/lib/date'
import type { ProjectForTimesheet, TimesheetEntryWithRelations } from '@/app/(protected)/timesheets/actions'

interface EntryRowProps {
  entry: TimesheetEntryWithRelations
  projects: ProjectForTimesheet[]
  isEditable: boolean
  onUpdate: (entryId: string, updates: Partial<EntryUpdate>) => void
  onDelete: (entryId: string) => void
}

interface EntryUpdate {
  project_id: string
  task_id: string | null
  billing_role_id: string | null
  hours: number[]
  is_billable: boolean
}

export function EntryRow({ entry, projects, isEditable, onUpdate, onDelete }: EntryRowProps) {
  const [projectId, setProjectId] = useState(entry.project_id)
  const [taskId, setTaskId] = useState(entry.task_id)
  const [billingRoleId, setBillingRoleId] = useState(entry.billing_role_id)
  const [hours, setHours] = useState<number[]>(entry.hours ?? [0, 0, 0, 0, 0, 0, 0])
  const [isBillable, setIsBillable] = useState(entry.is_billable ?? true)

  // Get available tasks and billing roles based on selected project
  const selectedProject = projects.find((p) => p.id === projectId)
  const availableTasks = selectedProject?.tasks ?? []
  const availableBillingRoles = selectedProject?.billing_roles ?? []

  // Calculate row total
  const rowTotal = sumHours(hours)

  // Debounced update function
  const debouncedUpdate = useCallback(
    (updates: Partial<EntryUpdate>) => {
      const timeout = setTimeout(() => {
        onUpdate(entry.id, updates)
      }, 500)
      return () => clearTimeout(timeout)
    },
    [entry.id, onUpdate]
  )

  // Handle hour change for a specific day
  const handleHourChange = (dayIndex: number, value: number) => {
    const newHours = [...hours]
    newHours[dayIndex] = value
    setHours(newHours)
    debouncedUpdate({ hours: newHours })
  }

  // Handle project change - reset task and billing role
  const handleProjectChange = (value: string) => {
    setProjectId(value)
    setTaskId(null)
    setBillingRoleId(null)
    onUpdate(entry.id, { project_id: value, task_id: null, billing_role_id: null })
  }

  // Handle task change
  const handleTaskChange = (value: string) => {
    const newTaskId = value === 'none' ? null : value
    setTaskId(newTaskId)
    onUpdate(entry.id, { task_id: newTaskId })
  }

  // Handle billing role change
  const handleBillingRoleChange = (value: string) => {
    const newRoleId = value === 'none' ? null : value
    setBillingRoleId(newRoleId)
    onUpdate(entry.id, { billing_role_id: newRoleId })
  }

  // Handle billable change
  const handleBillableChange = (checked: boolean) => {
    setIsBillable(checked)
    onUpdate(entry.id, { is_billable: checked })
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border bg-card p-3">
      {/* Project/Task/Role Selection */}
      <div className="w-[200px] flex-shrink-0 space-y-2">
        {/* Project Selector */}
        <Select value={projectId} onValueChange={handleProjectChange} disabled={!isEditable}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <span className="font-mono text-xs">{project.code}</span>
                <span className="ml-1 text-muted-foreground">{project.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Task Selector */}
        <Select
          value={taskId ?? 'none'}
          onValueChange={handleTaskChange}
          disabled={!isEditable || availableTasks.length === 0}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Task (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No task</SelectItem>
            {availableTasks.map((task) => (
              <SelectItem key={task.id} value={task.id}>
                <span className="font-mono text-xs">{task.code}</span>
                <span className="ml-1">{task.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Billing Role Selector */}
        <Select
          value={billingRoleId ?? 'none'}
          onValueChange={handleBillingRoleChange}
          disabled={!isEditable || availableBillingRoles.length === 0}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Billing role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No role</SelectItem>
            {availableBillingRoles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
                <span className="ml-1 text-muted-foreground">${role.rate}/hr</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Billable Checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id={`billable-${entry.id}`}
            checked={isBillable}
            onCheckedChange={handleBillableChange}
            disabled={!isEditable}
          />
          <label
            htmlFor={`billable-${entry.id}`}
            className="text-xs text-muted-foreground"
          >
            Billable
          </label>
        </div>
      </div>

      {/* Hours Inputs (Mon-Sun) */}
      <div className="flex flex-1 items-center gap-1">
        {hours.map((h, index) => (
          <div key={index} className="w-[60px]">
            <HourInput
              value={h}
              onChange={(value) => handleHourChange(index, value)}
              disabled={!isEditable}
            />
          </div>
        ))}
      </div>

      {/* Row Total */}
      <div className="flex w-[60px] flex-shrink-0 items-center justify-center">
        <span className="font-mono font-medium">{rowTotal.toFixed(1)}</span>
      </div>

      {/* Delete Button */}
      <div className="flex w-[40px] flex-shrink-0 items-center justify-center">
        {isEditable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete entry</span>
          </Button>
        )}
      </div>
    </div>
  )
}
