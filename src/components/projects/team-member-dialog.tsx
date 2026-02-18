'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  addTeamMemberAction,
  updateTeamMemberAction,
} from '@/app/(protected)/projects/[id]/team/actions'

interface Member {
  id: string
  is_active: boolean | null
  created_at: string | null
  user: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  billing_role: {
    id: string
    name: string
    rate: number
  } | null
}

interface BillingRole {
  id: string
  name: string
  rate: number
}

interface UserOption {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface TeamMemberDialogProps {
  projectId: string
  member?: Member | null
  billingRoles: BillingRole[]
  availableUsers: UserOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TeamMemberDialog({
  projectId,
  member,
  billingRoles,
  availableUsers,
  open,
  onOpenChange,
}: TeamMemberDialogProps) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')

  const isEdit = !!member

  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setError(null)
      setSelectedUserId(member?.user?.id ?? '')
      setSelectedRoleId(member?.billing_role?.id ?? '')
    }
    onOpenChange(open)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    try {
      const result = isEdit
        ? await updateTeamMemberAction(projectId, member.id, selectedRoleId || null)
        : await addTeamMemberAction(projectId, selectedUserId, selectedRoleId || null)

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Update Team Member' : 'Add Team Member'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? `Update billing role for ${member.user?.first_name} ${member.user?.last_name}`
                : 'Add a new member to this project team'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="user">User *</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="billing_role">Billing Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select billing role (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No billing role</SelectItem>
                  {billingRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({formatCurrency(role.rate)}/hr)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {billingRoles.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No billing roles defined. Add them in the Billing Roles tab first.
                </p>
              )}
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
            <Button type="submit" disabled={isPending || (!isEdit && !selectedUserId)}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Update' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
