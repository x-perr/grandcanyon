'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FileText, Send, Loader2, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WeekPicker } from '@/components/timesheets/week-picker'
import { formatCurrency } from '@/lib/tax'
import {
  generateBatchInvoices,
  sendBatchInvoices,
  type BatchInvoicePreview,
} from '@/app/(protected)/invoices/actions'

interface BatchInvoiceClientProps {
  weekStart: string
  clients: BatchInvoicePreview[]
}

type InvoiceState = {
  invoiceId?: string
  invoiceNumber?: string
  status: 'pending' | 'generating' | 'generated' | 'sending' | 'sent' | 'error'
  error?: string
}

export function BatchInvoiceClient({ weekStart, clients }: BatchInvoiceClientProps) {
  const t = useTranslations('invoices')
  const router = useRouter()
  const [isGenerating, startGenerateTransition] = useTransition()
  const [isSending, startSendTransition] = useTransition()

  // Track state for each client
  const [clientStates, setClientStates] = useState<Record<string, InvoiceState>>(() => {
    const states: Record<string, InvoiceState> = {}
    clients.forEach((c) => {
      states[c.clientId] = { status: 'pending' }
    })
    return states
  })

  // Track selected clients for generation
  const [selectedClients, setSelectedClients] = useState<Set<string>>(() => new Set(clients.map((c) => c.clientId)))

  // Calculate totals
  const totals = useMemo(() => {
    const selected = clients.filter((c) => selectedClients.has(c.clientId))
    return {
      clients: selected.length,
      hours: selected.reduce((sum, c) => sum + c.totalHours, 0),
      amount: selected.reduce((sum, c) => sum + c.totalAmount, 0),
    }
  }, [clients, selectedClients])

  // Get generated invoices that can be sent
  const generatedInvoices = useMemo(() => {
    return Object.entries(clientStates)
      .filter(([, state]) => state.status === 'generated' && state.invoiceId)
      .map(([clientId, state]) => ({
        clientId,
        invoiceId: state.invoiceId!,
        invoiceNumber: state.invoiceNumber!,
      }))
  }, [clientStates])

  // Toggle client selection
  const toggleClient = useCallback((clientId: string) => {
    setSelectedClients((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }, [])

  // Toggle all clients
  const toggleAll = useCallback(() => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(clients.map((c) => c.clientId)))
    }
  }, [clients, selectedClients.size])

  // Handle generate all invoices
  const handleGenerateAll = useCallback(() => {
    if (selectedClients.size === 0) {
      toast.error(t('batch.no_clients_selected'))
      return
    }

    // Mark selected as generating
    setClientStates((prev) => {
      const next = { ...prev }
      selectedClients.forEach((id) => {
        next[id] = { status: 'generating' }
      })
      return next
    })

    startGenerateTransition(async () => {
      const result = await generateBatchInvoices(weekStart)

      if (result.error) {
        toast.error(result.error)
        // Reset to pending
        setClientStates((prev) => {
          const next = { ...prev }
          selectedClients.forEach((id) => {
            next[id] = { status: 'pending' }
          })
          return next
        })
        return
      }

      // Update states based on results
      setClientStates((prev) => {
        const next = { ...prev }
        result.results.forEach((r) => {
          if (r.success) {
            next[r.clientId] = {
              status: 'generated',
              invoiceId: r.invoiceId,
              invoiceNumber: r.invoiceNumber,
            }
          } else {
            next[r.clientId] = {
              status: 'error',
              error: r.error,
            }
          }
        })
        return next
      })

      const successCount = result.results.filter((r) => r.success).length
      const errorCount = result.results.filter((r) => !r.success).length

      if (errorCount === 0) {
        toast.success(t('batch.generated_success', { count: successCount }))
      } else if (successCount > 0) {
        toast.warning(t('batch.generated_partial', { success: successCount, error: errorCount }))
      } else {
        toast.error(t('batch.generated_failed'))
      }

      router.refresh()
    })
  }, [weekStart, selectedClients, t, router])

  // Handle send all generated invoices
  const handleSendAll = useCallback(() => {
    if (generatedInvoices.length === 0) {
      toast.error(t('batch.no_invoices_to_send'))
      return
    }

    // Mark as sending
    setClientStates((prev) => {
      const next = { ...prev }
      generatedInvoices.forEach(({ clientId }) => {
        if (next[clientId]) {
          next[clientId] = { ...next[clientId], status: 'sending' }
        }
      })
      return next
    })

    startSendTransition(async () => {
      const invoiceIds = generatedInvoices.map((i) => i.invoiceId)
      const result = await sendBatchInvoices(invoiceIds)

      // Update states based on results
      setClientStates((prev) => {
        const next = { ...prev }
        result.results.forEach((r) => {
          const inv = generatedInvoices.find((i) => i.invoiceId === r.invoiceId)
          if (inv) {
            if (r.success) {
              next[inv.clientId] = { ...next[inv.clientId], status: 'sent' }
            } else {
              next[inv.clientId] = { ...next[inv.clientId], status: 'error', error: r.error }
            }
          }
        })
        return next
      })

      const successCount = result.results.filter((r) => r.success).length
      const errorCount = result.results.filter((r) => !r.success).length

      if (errorCount === 0) {
        toast.success(t('batch.sent_success', { count: successCount }))
      } else if (successCount > 0) {
        toast.warning(t('batch.sent_partial', { success: successCount, error: errorCount }))
      } else {
        toast.error(t('batch.sent_failed'))
      }

      router.refresh()
    })
  }, [generatedInvoices, t, router])

  // Get status icon for a client
  const getStatusIcon = (state: InvoiceState) => {
    switch (state.status) {
      case 'generating':
      case 'sending':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      case 'generated':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return null
    }
  }

  const isPending = isGenerating || isSending

  return (
    <div className="space-y-6">
      {/* Back link and Week Picker */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('detail.back_to_invoices')}
          </Link>
        </Button>
        <WeekPicker weekStart={weekStart} basePath="/invoices/batch" />
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('batch.preview_title')}</CardTitle>
          <CardDescription>{t('batch.preview_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">{t('batch.no_clients')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t('batch.no_clients_message')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Totals */}
              <div className="flex flex-wrap gap-4 rounded-lg bg-muted/50 p-4">
                <div>
                  <div className="text-sm text-muted-foreground">{t('batch.selected_clients')}</div>
                  <div className="text-2xl font-bold">{totals.clients}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('batch.total_hours')}</div>
                  <div className="text-2xl font-bold">{totals.hours.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('batch.total_amount')}</div>
                  <div className="text-2xl font-bold">{formatCurrency(totals.amount)}</div>
                </div>
              </div>

              {/* Client List */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedClients.size === clients.length}
                          onCheckedChange={toggleAll}
                          disabled={isPending}
                        />
                      </TableHead>
                      <TableHead>{t('batch.client')}</TableHead>
                      <TableHead className="text-right">{t('batch.hours')}</TableHead>
                      <TableHead className="text-right">{t('batch.amount')}</TableHead>
                      <TableHead>{t('batch.email')}</TableHead>
                      <TableHead className="w-[100px]">{t('batch.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => {
                      const state = clientStates[client.clientId]
                      return (
                        <TableRow key={client.clientId}>
                          <TableCell>
                            <Checkbox
                              checked={selectedClients.has(client.clientId)}
                              onCheckedChange={() => toggleClient(client.clientId)}
                              disabled={isPending || state?.status !== 'pending'}
                            />
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help text-left">
                                    <div className="font-medium">{client.clientName}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {client.projects.length} {t('batch.projects')}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <div className="space-y-1">
                                    {client.projects.map((project) => (
                                      <div key={project.projectId} className="text-sm">
                                        <span className="font-medium">{project.projectCode}</span>
                                        {' - '}
                                        {project.totalHours.toFixed(1)}h / {formatCurrency(project.totalAmount)}
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {client.totalHours.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(client.totalAmount)}
                          </TableCell>
                          <TableCell>
                            {client.billingEmail ? (
                              <span className="text-sm">{client.billingEmail}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {t('batch.no_email')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(state)}
                              {state?.invoiceNumber && (
                                <Link
                                  href={`/invoices/${state.invoiceId}`}
                                  className="text-sm text-primary hover:underline"
                                >
                                  {state.invoiceNumber}
                                </Link>
                              )}
                              {state?.error && (
                                <span className="text-sm text-destructive">{state.error}</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerateAll}
                  disabled={isPending || selectedClients.size === 0}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {t('batch.generate_all')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSendAll}
                  disabled={isPending || generatedInvoices.length === 0}
                >
                  {isSending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {t('batch.send_all')} ({generatedInvoices.length})
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
