'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  createBillingRoleAction,
  updateBillingRoleAction,
} from '@/app/(protected)/projects/[id]/billing-roles/actions'

interface BillingRole {
  id: string
  name: string
  rate: number
  created_at: string | null
}

interface BillingRoleDialogProps {
  projectId: string
  role?: BillingRole | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BillingRoleDialog({ projectId, role, open, onOpenChange }: BillingRoleDialogProps) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!role

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)

    try {
      const result = isEdit
        ? await updateBillingRoleAction(projectId, role.id, formData)
        : await createBillingRoleAction(projectId, formData)

      if (result?.error) {
        setError(result.error)
      } else {
        onOpenChange(false)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Billing Role' : 'Add Billing Role'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update the billing role details' : 'Add a new billing role for this project'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Senior Engineer"
                defaultValue={role?.name ?? ''}
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Hourly Rate *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="rate"
                  name="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  defaultValue={role?.rate ?? ''}
                  className="pl-7"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Rate per hour in CAD</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
