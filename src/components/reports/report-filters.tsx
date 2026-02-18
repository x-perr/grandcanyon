'use client'

import { useTransition, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProjectForFilter, UserForFilter, ClientForFilter } from '@/app/(protected)/reports/actions'
import { getDateRangeFromPreset, type DateRangePreset } from '@/lib/validations/report'

interface ReportFiltersProps {
  basePath: string // e.g., '/reports/timesheets'
  projects?: ProjectForFilter[]
  users?: UserForFilter[]
  clients?: ClientForFilter[]
  showProjectFilter?: boolean
  showUserFilter?: boolean
  showClientFilter?: boolean
  showStatusFilter?: boolean
  statusOptions?: { value: string; label: string }[]
  currentFilters: {
    startDate?: string
    endDate?: string
    projectId?: string
    userId?: string
    clientId?: string
    status?: string
    preset?: string
  }
}

const datePresets: { value: DateRangePreset; label: string }[] = [
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
]

export function ReportFilters({
  basePath,
  projects = [],
  users = [],
  clients = [],
  showProjectFilter = true,
  showUserFilter = false,
  showClientFilter = false,
  showStatusFilter = false,
  statusOptions = [],
  currentFilters,
}: ReportFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [startDate, setStartDate] = useState(currentFilters.startDate ?? '')
  const [endDate, setEndDate] = useState(currentFilters.endDate ?? '')

  // Sync local state with URL params
  useEffect(() => {
    setStartDate(currentFilters.startDate ?? '')
    setEndDate(currentFilters.endDate ?? '')
  }, [currentFilters.startDate, currentFilters.endDate])

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`)
    })
  }

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = getDateRangeFromPreset(preset)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
    updateFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      preset,
    })
  }

  const handleDateChange = () => {
    updateFilters({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      preset: undefined, // Clear preset when manually setting dates
    })
  }

  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    startTransition(() => {
      router.push(basePath)
    })
  }

  const hasFilters =
    currentFilters.startDate ||
    currentFilters.endDate ||
    currentFilters.projectId ||
    currentFilters.userId ||
    currentFilters.clientId ||
    currentFilters.status

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {/* Date Presets */}
      <div className="flex flex-wrap gap-2">
        {datePresets.map((preset) => (
          <Button
            key={preset.value}
            variant={currentFilters.preset === preset.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset.value)}
            disabled={isPending}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Date Range Inputs */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[150px]">
          <Label htmlFor="startDate" className="text-sm text-muted-foreground">
            From
          </Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onBlur={handleDateChange}
              className="pl-10"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex-1 min-w-[150px]">
          <Label htmlFor="endDate" className="text-sm text-muted-foreground">
            To
          </Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onBlur={handleDateChange}
              className="pl-10"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Project Filter */}
        {showProjectFilter && projects.length > 0 && (
          <div className="flex-1 min-w-[180px]">
            <Label className="text-sm text-muted-foreground">Project</Label>
            <Select
              value={currentFilters.projectId ?? 'all'}
              onValueChange={(value) =>
                updateFilters({ projectId: value === 'all' ? undefined : value })
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* User Filter */}
        {showUserFilter && users.length > 0 && (
          <div className="flex-1 min-w-[180px]">
            <Label className="text-sm text-muted-foreground">User</Label>
            <Select
              value={currentFilters.userId ?? 'all'}
              onValueChange={(value) =>
                updateFilters({ userId: value === 'all' ? undefined : value })
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Client Filter */}
        {showClientFilter && clients.length > 0 && (
          <div className="flex-1 min-w-[180px]">
            <Label className="text-sm text-muted-foreground">Client</Label>
            <Select
              value={currentFilters.clientId ?? 'all'}
              onValueChange={(value) =>
                updateFilters({ clientId: value === 'all' ? undefined : value })
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.code} - {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Status Filter */}
        {showStatusFilter && statusOptions.length > 0 && (
          <div className="flex-1 min-w-[150px]">
            <Label className="text-sm text-muted-foreground">Status</Label>
            <Select
              value={currentFilters.status ?? 'all'}
              onValueChange={(value) =>
                updateFilters({ status: value === 'all' ? undefined : value })
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearFilters}
            disabled={isPending}
            title="Clear all filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
