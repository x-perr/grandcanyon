'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StepSelectProject } from './step-select-project'
import { StepSelectEntries } from './step-select-entries'
import { StepReview } from './step-review'
import { createInvoice, sendInvoice } from '@/app/(protected)/invoices/actions'
import { calculateTaxes, calculateLineAmount } from '@/lib/tax'
import { getDefaultInvoiceDates, getDefaultPeriod, type InvoiceLineFormData } from '@/lib/validations/invoice'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, Save, Send } from 'lucide-react'
import type { ClientForSelect, ProjectForSelect, UninvoicedEntry } from '@/app/(protected)/invoices/actions'
import type { OtBillingConfig } from '@/types/billing'
import { useTranslations } from 'next-intl'

interface InvoiceWizardProps {
  step: 1 | 2 | 3
  clients: ClientForSelect[]
  projects: ProjectForSelect[]
  entries: UninvoicedEntry[]
  nextInvoiceNumber: string
  clientTaxSettings?: {
    charges_gst: boolean
    charges_qst: boolean
  }
  otBillingConfig?: OtBillingConfig | null
  otStandardMultiplier?: number
  initialValues: {
    client_id?: string
    project_id?: string
    period_start?: string
    period_end?: string
    selectedEntryIds: string[]
  }
}

/** Day-level OT flag shape */
type OtDayFlag = {
  type: 'standard_ot' | 'weekend' | 'conditions' | 'custom'
  status: 'pending' | 'approved' | 'rejected'
  multiplier?: number
}

/** Get the effective OT multiplier for an entry day */
function getOtMultiplier(
  dayFlag: OtDayFlag | undefined,
  otConfig: OtBillingConfig | null | undefined,
  standardMultiplier: number,
): number | null {
  if (!dayFlag || dayFlag.status !== 'approved') return null
  if (!otConfig || otConfig.mode === 'off') return null
  if (otConfig.mode === 'flat') return null // flat = same rate, no split

  // Use day-level multiplier if present (custom per-day)
  if (dayFlag.multiplier) return dayFlag.multiplier

  // Otherwise use config-level multiplier
  if (otConfig.mode === 'custom' && otConfig.ot_1_5x) return otConfig.ot_1_5x
  return standardMultiplier // default 1.5x
}

/** Split an entry's hours into regular and OT portions */
function splitEntryHours(
  entry: UninvoicedEntry,
  otConfig: OtBillingConfig | null | undefined,
  standardMultiplier: number,
): { regularHours: number; otHours: number; otMultiplier: number } {
  const hours = entry.hours ?? []
  const otFlags = entry.ot_flags

  if (!otFlags?.days || !otConfig || otConfig.mode === 'off' || otConfig.mode === 'flat') {
    // No OT split needed
    const total = hours.reduce((sum, h) => sum + (h ?? 0), 0)
    return { regularHours: total, otHours: 0, otMultiplier: 1 }
  }

  let regularHours = 0
  let otHours = 0
  let effectiveMultiplier = standardMultiplier

  hours.forEach((h, dayIndex) => {
    const dayKey = String(dayIndex)
    const dayFlag = otFlags.days?.[dayKey]
    const mult = getOtMultiplier(dayFlag, otConfig, standardMultiplier)

    if (mult !== null && (h ?? 0) > 0) {
      otHours += h ?? 0
      effectiveMultiplier = mult // use last seen multiplier for the group
    } else {
      regularHours += h ?? 0
    }
  })

  return {
    regularHours,
    otHours,
    otMultiplier: effectiveMultiplier,
  }
}

export function InvoiceWizard({
  step,
  clients,
  projects,
  entries,
  nextInvoiceNumber,
  clientTaxSettings,
  otBillingConfig,
  otStandardMultiplier = 1.5,
  initialValues,
}: InvoiceWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const t = useTranslations('invoices')

  // Local state for form values
  const [clientId, setClientId] = useState(initialValues.client_id ?? '')
  const [projectId, setProjectId] = useState(initialValues.project_id ?? '')
  const defaultPeriod = getDefaultPeriod()
  const [periodStart, setPeriodStart] = useState(initialValues.period_start || defaultPeriod.period_start)
  const [periodEnd, setPeriodEnd] = useState(initialValues.period_end || defaultPeriod.period_end)
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>(initialValues.selectedEntryIds)

  // Step 3 additional state
  const defaults = getDefaultInvoiceDates()
  const [invoiceDate, setInvoiceDate] = useState(defaults.invoice_date)
  const [dueDate, setDueDate] = useState(defaults.due_date)
  const [notes, setNotes] = useState('')

  // Build URL params
  const buildParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const values = {
      step: String(step),
      client_id: clientId,
      project_id: projectId,
      period_start: periodStart,
      period_end: periodEnd,
      entries: selectedEntryIds.join(','),
      ...updates,
    }

    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      }
    })

    return params.toString()
  }

  // Navigation
  const goToStep = (newStep: number) => {
    const params = buildParams({ step: String(newStep) })
    startTransition(() => {
      router.push(`/invoices/new?${params}`)
    })
  }

  const handleNext = () => {
    if (step === 1) {
      if (!clientId || !projectId) {
        toast.error(t('wizard.validation_select_client_project'))
        return
      }
      goToStep(2)
    } else if (step === 2) {
      if (selectedEntryIds.length === 0) {
        toast.error(t('wizard.validation_select_entries'))
        return
      }
      goToStep(3)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      goToStep(step - 1)
    } else {
      router.push('/invoices')
    }
  }

  // When client changes, reset project
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId)
    setProjectId('')
    // Update URL to reload projects
    const params = new URLSearchParams()
    params.set('step', '1')
    params.set('client_id', newClientId)
    startTransition(() => {
      router.push(`/invoices/new?${params.toString()}`)
    })
  }

  // When project changes, update URL
  const handleProjectChange = (newProjectId: string) => {
    setProjectId(newProjectId)
  }

  // Build line items from selected entries (grouped, with OT split)
  const buildLineItems = (): InvoiceLineFormData[] => {
    const selectedEntries = entries.filter((e) => selectedEntryIds.includes(e.id))

    // Group by billing_role + user + is_ot for cleaner invoices
    type GroupData = {
      entries: UninvoicedEntry[]
      regularHours: number
      otHours: number
      otMultiplier: number
      rate: number
      rateSource: UninvoicedEntry['rate_source']
      rateTierCode: UninvoicedEntry['rate_tier_code']
      rateClassificationLevel: UninvoicedEntry['rate_classification_level']
    }
    const grouped = new Map<string, GroupData>()

    selectedEntries.forEach((entry) => {
      const roleId = entry.billing_role?.id ?? 'no-role'
      const userId = entry.timesheet?.user?.id ?? 'no-user'
      const rate = entry.resolved_rate ?? entry.billing_role?.rate ?? 0
      const { regularHours, otHours, otMultiplier } = splitEntryHours(entry, otBillingConfig, otStandardMultiplier)

      // Regular hours group
      if (regularHours > 0) {
        const regKey = `${roleId}-${userId}-reg`
        if (!grouped.has(regKey)) {
          grouped.set(regKey, {
            entries: [],
            regularHours: 0,
            otHours: 0,
            otMultiplier: 1,
            rate,
            rateSource: entry.rate_source,
            rateTierCode: entry.rate_tier_code,
            rateClassificationLevel: entry.rate_classification_level,
          })
        }
        const group = grouped.get(regKey)!
        group.entries.push(entry)
        group.regularHours += regularHours
      }

      // OT hours group (separate line item)
      if (otHours > 0) {
        const otKey = `${roleId}-${userId}-ot`
        if (!grouped.has(otKey)) {
          grouped.set(otKey, {
            entries: [],
            regularHours: 0,
            otHours: 0,
            otMultiplier,
            rate,
            rateSource: entry.rate_source,
            rateTierCode: entry.rate_tier_code,
            rateClassificationLevel: entry.rate_classification_level,
          })
        }
        const group = grouped.get(otKey)!
        group.entries.push(entry)
        group.otHours += otHours
      }
    })

    // Convert to line items
    const lines: InvoiceLineFormData[] = []
    let sortOrder = 1

    grouped.forEach((group, key) => {
      const firstEntry = group.entries[0]
      const userName = firstEntry.timesheet?.user
        ? `${firstEntry.timesheet.user.first_name} ${firstEntry.timesheet.user.last_name}`
        : 'Unknown'
      const roleName = firstEntry.billing_role?.name ?? 'General'
      const isOt = key.endsWith('-ot')

      const quantity = isOt ? group.otHours : group.regularHours
      const effectiveRate = isOt ? group.rate * group.otMultiplier : group.rate
      const amount = calculateLineAmount(quantity, effectiveRate)

      const description = isOt
        ? `${roleName} - ${userName} ${t('ot.line_suffix', { multiplier: group.otMultiplier })}`
        : `${roleName} - ${userName}`

      lines.push({
        description,
        quantity,
        unit_price: effectiveRate,
        amount,
        timesheet_entry_id: firstEntry.id,
        sort_order: sortOrder++,
        rate_source: group.rateSource,
        rate_tier_code: group.rateTierCode,
        rate_classification_level: group.rateClassificationLevel,
        is_ot: isOt,
        ot_multiplier: isOt ? group.otMultiplier : null,
      })
    })

    return lines
  }

  // Calculate totals
  const calculateTotals = () => {
    const lines = buildLineItems()
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
    return calculateTaxes(
      subtotal,
      clientTaxSettings?.charges_gst ?? true,
      clientTaxSettings?.charges_qst ?? true
    )
  }

  // Submit handlers
  const handleSaveDraft = async () => {
    setIsSubmitting(true)
    try {
      // Create per-entry lines (one line per entry, split by OT)
      const linesWithEntries: InvoiceLineFormData[] = []
      const selectedEntries = entries.filter((e) => selectedEntryIds.includes(e.id))

      let sortIndex = 1
      selectedEntries.forEach((entry) => {
        const userName = entry.timesheet?.user
          ? `${entry.timesheet.user.first_name} ${entry.timesheet.user.last_name}`
          : 'Unknown'
        const roleName = entry.billing_role?.name ?? 'General'
        const rate = entry.resolved_rate ?? entry.billing_role?.rate ?? 0
        const weekLabel = entry.timesheet?.week_start ?? 'N/A'

        const { regularHours, otHours, otMultiplier } = splitEntryHours(entry, otBillingConfig, otStandardMultiplier)

        // Regular line
        if (regularHours > 0) {
          linesWithEntries.push({
            description: `${roleName} - ${userName} (Week of ${weekLabel})`,
            quantity: regularHours,
            unit_price: rate,
            amount: calculateLineAmount(regularHours, rate),
            timesheet_entry_id: entry.id,
            sort_order: sortIndex++,
            rate_source: entry.rate_source,
            rate_tier_code: entry.rate_tier_code,
            rate_classification_level: entry.rate_classification_level,
            is_ot: false,
            ot_multiplier: null,
          })
        }

        // OT line (separate)
        if (otHours > 0) {
          const otRate = rate * otMultiplier
          linesWithEntries.push({
            description: `${roleName} - ${userName} (Week of ${weekLabel}) ${t('ot.line_suffix', { multiplier: otMultiplier })}`,
            quantity: otHours,
            unit_price: otRate,
            amount: calculateLineAmount(otHours, otRate),
            timesheet_entry_id: entry.id,
            sort_order: sortIndex++,
            rate_source: entry.rate_source,
            rate_tier_code: entry.rate_tier_code,
            rate_classification_level: entry.rate_classification_level,
            is_ot: true,
            ot_multiplier: otMultiplier,
          })
        }

        // If no hours at all (edge case), still create one line
        if (regularHours === 0 && otHours === 0) {
          const totalHours = entry.hours?.reduce((sum, h) => sum + (h ?? 0), 0) ?? 0
          linesWithEntries.push({
            description: `${roleName} - ${userName} (Week of ${weekLabel})`,
            quantity: totalHours,
            unit_price: rate,
            amount: calculateLineAmount(totalHours, rate),
            timesheet_entry_id: entry.id,
            sort_order: sortIndex++,
            rate_source: entry.rate_source,
            rate_tier_code: entry.rate_tier_code,
            rate_classification_level: entry.rate_classification_level,
          })
        }
      })

      const result = await createInvoice({
        client_id: clientId,
        project_id: projectId,
        invoice_date: invoiceDate,
        due_date: dueDate,
        period_start: periodStart,
        period_end: periodEnd,
        notes: notes || null,
        lines: linesWithEntries,
      })

      if ('error' in result && result.error) {
        toast.error(result.error)
        setIsSubmitting(false)
        return
      }

      // Navigate to the new invoice
      if ('invoiceId' in result && result.invoiceId) {
        toast.success(t('toast.created'))
        router.push(`/invoices/${result.invoiceId}`)
      } else {
        toast.error(t('toast.error_send'))
        setIsSubmitting(false)
      }
    } catch {
      toast.error(t('toast.error_send'))
      setIsSubmitting(false)
    }
  }

  const handleCreateAndSend = async () => {
    // First save as draft, then send
    // The createInvoice action redirects, so we can't easily chain
    // For now, just save as draft - user can send from detail page
    toast.info(t('wizard.creating_info'))
    await handleSaveDraft()
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : s < step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div className={`h-0.5 w-8 ${s < step ? 'bg-primary/50' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          {step === 1 && (
            <StepSelectProject
              clients={clients}
              projects={projects}
              clientId={clientId}
              projectId={projectId}
              onClientChange={handleClientChange}
              onProjectChange={handleProjectChange}
            />
          )}

          {step === 2 && (
            <StepSelectEntries
              entries={entries}
              selectedEntryIds={selectedEntryIds}
              onSelectionChange={setSelectedEntryIds}
              periodStart={periodStart}
              periodEnd={periodEnd}
              onPeriodStartChange={setPeriodStart}
              onPeriodEndChange={setPeriodEnd}
            />
          )}

          {step === 3 && (
            <StepReview
              invoiceNumber={nextInvoiceNumber}
              invoiceDate={invoiceDate}
              dueDate={dueDate}
              onInvoiceDateChange={setInvoiceDate}
              onDueDateChange={setDueDate}
              notes={notes}
              onNotesChange={setNotes}
              lines={buildLineItems()}
              totals={calculateTotals()}
              clientTaxSettings={clientTaxSettings}
              client={clients.find((c) => c.id === clientId)}
              project={projects.find((p) => p.id === projectId)}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={isPending || isSubmitting}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {step === 1 ? t('wizard.cancel') : t('wizard.back')}
        </Button>

        <div className="flex gap-2">
          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={isPending || (step === 2 && selectedEntryIds.length === 0)}
            >
              {t('wizard.continue')}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSubmitting || selectedEntryIds.length === 0}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {t('wizard.save_as_draft')}
              </Button>
              <Button
                onClick={handleCreateAndSend}
                disabled={isSubmitting || selectedEntryIds.length === 0}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {t('wizard.create_invoice')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
