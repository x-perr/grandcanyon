'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
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
      setError(tCommon('errors.generic'))
    } finally {
      setIsPending(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? t('team.edit_dialog_title') : t('team.add_dialog_title')}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? t('team.edit_dialog_desc')
                : t('team.add_dialog_desc')}
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
                <Label htmlFor="user">{t('team.member')} *</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('team.select_member')} />
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
              <Label htmlFor="billing_role">{t('team.billing_role')}</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('team.select_role')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{tCommon('labels.none')}</SelectItem>
                  {billingRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({formatCurrency(role.rate)}/h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {billingRoles.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('billing_roles.no_roles_message')}
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
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || (!isEdit && !selectedUserId)}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? tCommon('actions.save') : t('team.add_member')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
