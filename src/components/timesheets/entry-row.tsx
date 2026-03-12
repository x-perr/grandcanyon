'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Trash2, Paperclip, Upload, FileImage, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { HourInput } from './hour-input'
import { sumHours } from '@/lib/date'
import { uploadTimesheetReceipt, deleteTimesheetReceipt, updateTimesheetReceiptNote } from '@/app/(protected)/timesheets/actions'
import { toast } from 'sonner'
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
  const t = useTranslations('timesheets')
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, startUpload] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [isSavingNote, startSaveNote] = useTransition()

  const [projectId, setProjectId] = useState(entry.project_id)
  const [taskId, setTaskId] = useState(entry.task_id)
  const [billingRoleId, setBillingRoleId] = useState(entry.billing_role_id)
  const [hours, setHours] = useState<number[]>(entry.hours ?? [0, 0, 0, 0, 0, 0, 0])
  const [isBillable, setIsBillable] = useState(entry.is_billable ?? true)
  const entryAny = entry as Record<string, unknown>
  const [receiptUrl, setReceiptUrl] = useState<string | null>(entryAny.receipt_url as string ?? null)
  const [receiptNote, setReceiptNote] = useState(entryAny.receipt_note as string ?? '')
  const [receiptOpen, setReceiptOpen] = useState(false)

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

  // Handle receipt upload
  const handleReceiptSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error(t('receipt.invalid_file_type'))
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('receipt.file_too_large'))
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    startUpload(async () => {
      const result = await uploadTimesheetReceipt(entry.id, formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        setReceiptUrl(result.url ?? null)
        toast.success(t('receipt.upload_success'))
        router.refresh()
      }
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle receipt delete
  const handleReceiptDelete = () => {
    startDelete(async () => {
      const result = await deleteTimesheetReceipt(entry.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        setReceiptUrl(null)
        setReceiptNote('')
        toast.success(t('receipt.delete_success'))
        router.refresh()
      }
    })
  }

  // Handle receipt note save
  const handleReceiptNoteSave = () => {
    startSaveNote(async () => {
      const result = await updateTimesheetReceiptNote(entry.id, receiptNote || null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('receipt.note_saved'))
      }
    })
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border bg-card p-3">
      {/* Project/Task/Role Selection */}
      <div className="w-[200px] flex-shrink-0 space-y-2">
        {/* Project Selector */}
        <Select value={projectId} onValueChange={handleProjectChange} disabled={!isEditable}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={t('entry.select_project')} />
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
            <SelectValue placeholder={t('entry.task_optional')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('entry.no_task')}</SelectItem>
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
            <SelectValue placeholder={t('entry.role')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('entry.no_role')}</SelectItem>
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
            {t('entry.billable')}
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

      {/* Actions: Receipt + Delete */}
      <div className="flex w-[80px] flex-shrink-0 items-center justify-end gap-1">
        {/* Receipt Attachment */}
        <Popover open={receiptOpen} onOpenChange={setReceiptOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 ${receiptUrl ? 'text-green-600' : 'text-muted-foreground'}`}
              title={receiptUrl ? t('receipt.view') : t('receipt.attach')}
              aria-label={receiptUrl ? t('receipt.view') : t('receipt.attach')}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-3">
              <div className="font-medium text-sm">{t('receipt.title')}</div>

              {receiptUrl ? (
                <div className="space-y-2">
                  <div className="relative">
                    <img
                      src={receiptUrl}
                      alt="Receipt"
                      className="h-24 w-full rounded border object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-1 -top-1 h-5 w-5"
                      onClick={handleReceiptDelete}
                      disabled={isDeleting || !isEditable}
                      aria-label={t('receipt.delete')}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  {/* Receipt Note */}
                  <div className="space-y-1">
                    <Input
                      placeholder={t('receipt.note_placeholder')}
                      value={receiptNote}
                      onChange={(e) => setReceiptNote(e.target.value)}
                      disabled={!isEditable}
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReceiptNoteSave}
                      disabled={isSavingNote || !isEditable}
                      className="w-full h-7 text-xs"
                    >
                      {isSavingNote ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      {t('receipt.save_note')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex h-16 items-center justify-center rounded border-2 border-dashed border-muted-foreground/25">
                    <FileImage className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleReceiptSelect}
                    disabled={isUploading || !isEditable}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !isEditable}
                    className="w-full h-7 text-xs"
                  >
                    {isUploading ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="mr-1 h-3 w-3" />
                    )}
                    {t('receipt.upload')}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {t('receipt.file_requirements')}
                  </p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Delete Button */}
        {isEditable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{t('entry.delete_entry')}</span>
          </Button>
        )}
      </div>
    </div>
  )
}
