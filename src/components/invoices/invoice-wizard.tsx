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
  initialValues: {
    client_id?: string
    project_id?: string
    period_start?: string
    period_end?: string
    selectedEntryIds: string[]
  }
}

export function InvoiceWizard({
  step,
  clients,
  projects,
  entries,
  nextInvoiceNumber,
  clientTaxSettings,
  initialValues,
}: InvoiceWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        toast.error('Please select a client and project')
        return
      }
      goToStep(2)
    } else if (step === 2) {
      if (selectedEntryIds.length === 0) {
        toast.error('Please select at least one entry')
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

  // Build line items from selected entries
  const buildLineItems = (): InvoiceLineFormData[] => {
    const selectedEntries = entries.filter((e) => selectedEntryIds.includes(e.id))

    // Group by billing role + user for cleaner invoices
    const grouped = new Map<string, { entries: UninvoicedEntry[]; totalHours: number }>()

    selectedEntries.forEach((entry) => {
      const roleId = entry.billing_role?.id ?? 'no-role'
      const userId = entry.timesheet?.user?.id ?? 'no-user'
      const key = `${roleId}-${userId}`

      if (!grouped.has(key)) {
        grouped.set(key, { entries: [], totalHours: 0 })
      }

      const group = grouped.get(key)!
      group.entries.push(entry)
      const entryHours = entry.hours?.reduce((sum, h) => sum + (h ?? 0), 0) ?? 0
      group.totalHours += entryHours
    })

    // Convert to line items
    const lines: InvoiceLineFormData[] = []
    let sortOrder = 1

    grouped.forEach((group) => {
      const firstEntry = group.entries[0]
      const userName = firstEntry.timesheet?.user
        ? `${firstEntry.timesheet.user.first_name} ${firstEntry.timesheet.user.last_name}`
        : 'Unknown'
      const roleName = firstEntry.billing_role?.name ?? 'General'
      const rate = firstEntry.billing_role?.rate ?? 0

      const description = `${roleName} - ${userName}`
      const quantity = group.totalHours
      const amount = calculateLineAmount(quantity, rate)

      lines.push({
        description,
        quantity,
        unit_price: rate,
        amount,
        timesheet_entry_id: firstEntry.id, // Link to first entry (others linked during save)
        sort_order: sortOrder++,
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
      const lines = buildLineItems()

      // For each selected entry, we need to create a line item
      // But our grouping means we need to track all entry IDs
      const allEntryIds = selectedEntryIds

      // Create lines with all timesheet entry IDs
      const linesWithEntries: InvoiceLineFormData[] = []
      const selectedEntries = entries.filter((e) => allEntryIds.includes(e.id))

      selectedEntries.forEach((entry, index) => {
        const userName = entry.timesheet?.user
          ? `${entry.timesheet.user.first_name} ${entry.timesheet.user.last_name}`
          : 'Unknown'
        const roleName = entry.billing_role?.name ?? 'General'
        const rate = entry.billing_role?.rate ?? 0
        const hours = entry.hours?.reduce((sum, h) => sum + (h ?? 0), 0) ?? 0

        linesWithEntries.push({
          description: `${roleName} - ${userName} (Week of ${entry.timesheet?.week_start ?? 'N/A'})`,
          quantity: hours,
          unit_price: rate,
          amount: calculateLineAmount(hours, rate),
          timesheet_entry_id: entry.id,
          sort_order: index + 1,
        })
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

      console.log('createInvoice result:', result)

      if ('error' in result && result.error) {
        toast.error(result.error)
        setIsSubmitting(false)
        return
      }

      // Navigate to the new invoice
      if ('invoiceId' in result && result.invoiceId) {
        toast.success('Invoice created!')
        router.push(`/invoices/${result.invoiceId}`)
      } else {
        console.error('No invoiceId in result:', result)
        toast.error('Invoice created but navigation failed')
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      toast.error('Failed to create invoice')
      setIsSubmitting(false)
    }
  }

  const handleCreateAndSend = async () => {
    // First save as draft, then send
    // The createInvoice action redirects, so we can't easily chain
    // For now, just save as draft - user can send from detail page
    toast.info('Creating invoice... You can send it from the detail page.')
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
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        <div className="flex gap-2">
          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={isPending || (step === 2 && selectedEntryIds.length === 0)}
            >
              Continue
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
                Save as Draft
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
                Create Invoice
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
