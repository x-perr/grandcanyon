'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EntryRow } from './entry-row'
import { EntryDialog } from './entry-dialog'
import { getWeekDayLabels } from '@/lib/date'
import {
  saveTimesheetEntry,
  deleteTimesheetEntry,
  type ProjectForTimesheet,
  type TimesheetEntryWithRelations,
} from '@/app/(protected)/timesheets/actions'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'

interface TimesheetGridProps {
  timesheet: Tables<'timesheets'>
  entries: TimesheetEntryWithRelations[]
  projects: ProjectForTimesheet[]
  isEditable: boolean
}

export function TimesheetGrid({ timesheet, entries, projects, isEditable }: TimesheetGridProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const dayLabels = getWeekDayLabels()

  // Calculate day totals
  const dayTotals = Array.from({ length: 7 }, (_, dayIndex) => {
    return entries.reduce((sum, entry) => sum + (entry.hours?.[dayIndex] ?? 0), 0)
  })

  // Calculate week total
  const weekTotal = dayTotals.reduce((sum, d) => sum + d, 0)

  // Handle entry update
  const handleEntryUpdate = async (
    entryId: string,
    updates: {
      project_id?: string
      task_id?: string | null
      billing_role_id?: string | null
      hours?: number[]
      is_billable?: boolean
    }
  ) => {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return

    try {
      const result = await saveTimesheetEntry(timesheet.id, {
        id: entryId,
        project_id: updates.project_id ?? entry.project_id,
        task_id: updates.task_id !== undefined ? updates.task_id : entry.task_id,
        billing_role_id: updates.billing_role_id !== undefined ? updates.billing_role_id : entry.billing_role_id,
        hours: updates.hours ?? entry.hours ?? [0, 0, 0, 0, 0, 0, 0],
        is_billable: updates.is_billable !== undefined ? updates.is_billable : entry.is_billable ?? true,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error('Failed to save changes')
    }
  }

  // Handle entry delete
  const handleEntryDelete = async (entryId: string) => {
    try {
      const result = await deleteTimesheetEntry(entryId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Entry deleted')
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error('Failed to delete entry')
    }
  }

  // Handle add new entry
  const handleAddEntry = async (newEntry: {
    project_id: string
    task_id: string | null
    billing_role_id: string | null
    description: string | null
    is_billable: boolean
  }) => {
    try {
      const result = await saveTimesheetEntry(timesheet.id, {
        project_id: newEntry.project_id,
        task_id: newEntry.task_id,
        billing_role_id: newEntry.billing_role_id,
        description: newEntry.description,
        hours: [0, 0, 0, 0, 0, 0, 0],
        is_billable: newEntry.is_billable,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Entry added')
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error('Failed to add entry')
    }
  }

  return (
    <div className="space-y-4">
      {/* Column Headers */}
      <div className="flex items-center gap-2 px-3">
        <div className="w-[200px] flex-shrink-0">
          <span className="text-sm font-medium text-muted-foreground">Project / Task</span>
        </div>
        <div className="flex flex-1 items-center gap-1">
          {dayLabels.map((label, index) => (
            <div key={index} className="w-[60px] text-center">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <div className="w-[60px] flex-shrink-0 text-center">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
        </div>
        <div className="w-[40px] flex-shrink-0" />
      </div>

      {/* Entry Rows */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No entries yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {isEditable
                ? 'Add an entry to start tracking your time'
                : 'No time entries for this week'}
            </p>
            {isEditable && (
              <div className="mt-4">
                <EntryDialog projects={projects} onAdd={handleAddEntry} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              projects={projects}
              isEditable={isEditable}
              onUpdate={handleEntryUpdate}
              onDelete={handleEntryDelete}
            />
          ))}
        </div>
      )}

      {/* Add Entry Button */}
      {isEditable && entries.length > 0 && (
        <div className="flex justify-start pl-3">
          <EntryDialog projects={projects} onAdd={handleAddEntry} />
        </div>
      )}

      {/* Day Totals Row */}
      {entries.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-dashed bg-muted/50 px-3 py-3">
          <div className="w-[200px] flex-shrink-0">
            <span className="text-sm font-semibold">Day Totals</span>
          </div>
          <div className="flex flex-1 items-center gap-1">
            {dayTotals.map((total, index) => (
              <div key={index} className="w-[60px] text-center">
                <span
                  className={`font-mono text-sm font-medium ${
                    total > 12 ? 'text-orange-600' : total > 0 ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {total > 0 ? total.toFixed(1) : '-'}
                </span>
              </div>
            ))}
          </div>
          <div className="w-[60px] flex-shrink-0 text-center">
            <span className="font-mono text-sm font-bold">{weekTotal.toFixed(1)}</span>
          </div>
          <div className="w-[40px] flex-shrink-0" />
        </div>
      )}

      {/* Week Summary */}
      {entries.length > 0 && (
        <div className="flex justify-end">
          <div className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
            <span className="text-sm">Week Total: </span>
            <span className="font-mono text-lg font-bold">{weekTotal.toFixed(1)}</span>
            <span className="text-sm"> hours</span>
          </div>
        </div>
      )}
    </div>
  )
}
