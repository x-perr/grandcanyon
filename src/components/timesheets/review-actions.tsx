'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { approveTimesheet, rejectTimesheet } from '@/app/(protected)/timesheets/actions'
import { toast } from 'sonner'

interface ReviewActionsProps {
  timesheetId: string
  employeeName: string
}

export function ReviewActions({ timesheetId, employeeName }: ReviewActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      const result = await approveTimesheet(timesheetId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Timesheet approved')
        startTransition(() => {
          router.push('/timesheets?tab=approvals')
        })
      }
    } catch {
      toast.error('Failed to approve timesheet')
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    try {
      const result = await rejectTimesheet(timesheetId, rejectReason || undefined)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Timesheet rejected')
        setShowRejectDialog(false)
        startTransition(() => {
          router.push('/timesheets?tab=approvals')
        })
      }
    } catch {
      toast.error('Failed to reject timesheet')
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <>
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle>Approval Decision</CardTitle>
          <CardDescription>
            Review the timesheet above and approve or reject it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              size="lg"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={isApproving || isRejecting || isPending}
            >
              {isApproving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Check className="mr-2 h-5 w-5" />
              )}
              Approve Timesheet
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="flex-1"
              onClick={() => setShowRejectDialog(true)}
              disabled={isApproving || isRejecting || isPending}
            >
              <X className="mr-2 h-5 w-5" />
              Reject Timesheet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
            <DialogDescription>
              Reject {employeeName}&apos;s timesheet? They will be able to make changes and
              resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason for rejection (optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="Please explain why this timesheet is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This message will be shown to the employee.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false)
                setRejectReason('')
              }}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting}
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
