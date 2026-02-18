'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Eye, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { formatWeekRange, parseDateISO } from '@/lib/date'
import { approveTimesheet, rejectTimesheet } from '@/app/(protected)/timesheets/actions'
import type { TimesheetWithUser } from '@/app/(protected)/timesheets/actions'
import { toast } from 'sonner'

interface ApprovalQueueProps {
  timesheets: TimesheetWithUser[]
}

export function ApprovalQueue({ timesheets }: ApprovalQueueProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejectDialog, setRejectDialog] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleApprove = async (timesheetId: string) => {
    setProcessingId(timesheetId)
    try {
      const result = await approveTimesheet(timesheetId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Timesheet approved')
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error('Failed to approve timesheet')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectDialog) return
    setProcessingId(rejectDialog)
    try {
      const result = await rejectTimesheet(rejectDialog, rejectReason || undefined)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Timesheet rejected')
        setRejectDialog(null)
        setRejectReason('')
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error('Failed to reject timesheet')
    } finally {
      setProcessingId(null)
    }
  }

  const formatHours = (hours: number) => {
    return hours.toFixed(1)
  }

  const timesheetToReject = timesheets.find((ts) => ts.id === rejectDialog)

  if (timesheets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No pending approvals</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Timesheets from your team members will appear here when submitted
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timesheets.map((timesheet) => {
              const weekStart = parseDateISO(timesheet.week_start)
              const weekRange = formatWeekRange(weekStart)
              const employeeName = timesheet.user
                ? `${timesheet.user.first_name} ${timesheet.user.last_name}`
                : 'Unknown'
              const isProcessing = processingId === timesheet.id

              return (
                <TableRow key={timesheet.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{employeeName}</div>
                      <div className="text-sm text-muted-foreground">{timesheet.user?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{weekRange}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatHours(timesheet.total_hours ?? 0)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {timesheet.status && <StatusBadge status={timesheet.status} />}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/timesheets/${timesheet.week_start}/review?user=${timesheet.user_id}`)}
                        disabled={isProcessing}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Review</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={() => handleApprove(timesheet.id)}
                        disabled={isProcessing || isPending}
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">Approve</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setRejectDialog(timesheet.id)}
                        disabled={isProcessing || isPending}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Reject</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
            <DialogDescription>
              {timesheetToReject?.user && (
                <>
                  Reject timesheet for {timesheetToReject.user.first_name}{' '}
                  {timesheetToReject.user.last_name}?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter a reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialog(null)
                setRejectReason('')
              }}
              disabled={!!processingId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!!processingId}
            >
              {processingId ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
